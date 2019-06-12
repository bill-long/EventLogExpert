using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Linq;
using EventLogExpert;
using Xunit;
using Xunit.Abstractions;

namespace EventUtils.Test
{
    public class EventMessageProviderTests
    {
        public EventMessageProviderTests(ITestOutputHelper output)
        {
            _output = output;
        }

        private readonly ITestOutputHelper _output;

        [Fact]
        public void LoadAllLocalProvidersWorks()
        {
            // Arrange
            var session = new EventLogSession();
            var providers = new List<string>(session.GetProviderNames().OrderBy(name => name));

            // Act
            var providerData = new List<ProviderDetails>();
            foreach (var providerName in providers)
            {
                var p = new EventMessageProvider(providerName, _output.WriteLine);
                providerData.Add(p.LoadProviderDetails());
            }

            int messageCount = providerData.Sum(p => p.Messages.Count());
            int eventCount = providerData.Sum(p => p.Events?.Count ?? 0);

            // Assert
            _output.WriteLine($"Found {providers.Count} providers and loaded {messageCount} messages and {eventCount} events.");
            Assert.True(messageCount > 1000);
        }

        [Fact]
        public void LoadOneProviderWorks()
        {
            // Arrange
            var emp = new EventMessageProvider("Application Error", _output.WriteLine);

            // Act
            var result = emp.LoadProviderDetails();

            // Assert
            Assert.NotEmpty(result.Messages);
        }

        [Fact]
        public void ResolveLocalEventsWorks()
        {
            // Arrange
            var session = new EventLogSession();
            var providers = new List<string>(session.GetProviderNames().Distinct().OrderBy(name => name));

            // Act
            var providerData = new Dictionary<string, ProviderDetails>();
            foreach (var providerName in providers)
            {
                var p = new EventMessageProvider(providerName, _output.WriteLine);
                providerData.Add(providerName, p.LoadProviderDetails());
            }

            var reader = new EventLogReader("Application", PathType.LogName) { BatchSize = 1000 };
            EventRecord evt;

            var found = 0;
            var notfound = 0;
            var total = 0;
            while (null != (evt = reader.ReadEvent()))
            {
                total += 1;

                if (!providerData.TryGetValue(evt.ProviderName, out var provider))
                {
                    _output.WriteLine("Could not find provider: " + evt.ProviderName);
                    continue;
                }

                if (provider.Events?.FirstOrDefault(e => e.Id == evt.Id) == null)
                {
                    if (provider.Messages.FirstOrDefault(m => m.RawId == evt.Id) == null)
                    {
                        if (provider.Messages.FirstOrDefault(m => m.ShortId == evt.Id) == null)
                        {
                            notfound += 1;
                            _output.WriteLine($"Could not find event matching id {evt.Id} for provider {evt.ProviderName}");
                        }
                    }
                }

                found += 1;
            }

            _output.WriteLine($"Total: {total}");
            _output.WriteLine($"Found: {found}");
            _output.WriteLine($"Not found: {notfound}");

            // Assert
            // Must find at least 90% to pass this test
            Assert.True(found > total * .9);
        }
    }
}