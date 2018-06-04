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
            var messages = new List<Message>();
            foreach (var providerName in providers)
            {
                var p = new EventMessageProvider(providerName, _output.WriteLine);
                messages.AddRange(p.LoadMessages());
            }

            // Assert
            _output.WriteLine($"Found {providers.Count} providers and loaded {messages.Count} messages");
            Assert.True(messages.Count > 1000000);
        }

        [Fact]
        public void LoadOneProviderWorks()
        {
            // Arrange
            var emp = new EventMessageProvider("Application Error", _output.WriteLine);

            // Act
            var result = emp.LoadMessages();

            // Assert
            Assert.NotEmpty(result);
        }

        [Fact]
        public void ResolveLocalEventsWorks()
        {
            // Arrange
            var session = new EventLogSession();
            var providers = new List<string>(session.GetProviderNames().Distinct().OrderBy(name => name));

            // Act
            var messages = new Dictionary<string, Dictionary<long, Message>>();
            foreach (var providerName in providers)
            {
                var p = new EventMessageProvider(providerName, _output.WriteLine);
                var eventDictionary = new Dictionary<long, Message>();
                messages.Add(providerName, eventDictionary);
                foreach (var m in p.LoadMessages())
                {
                    if (eventDictionary.ContainsKey(m.RawId))
                    {
                        _output.WriteLine($"Duplicate raw event ID {m.RawId} for provider {providerName}");
                    }
                    else
                    {
                        eventDictionary.Add(m.RawId, m);
                    }
                }
            }

            var reader = new EventLogReader("Application", PathType.LogName) { BatchSize = 1000 };
            EventRecord evt;

            var found = 0;
            var notfound = 0;
            var total = 0;
            while (null != (evt = reader.ReadEvent()))
            {
                total += 1;

                if (!messages.TryGetValue(evt.ProviderName, out var eventIdDictionary))
                {
                    _output.WriteLine("Could not find provider: " + evt.ProviderName);
                    continue;
                }

                if (!eventIdDictionary.TryGetValue(evt.Id, out var message))
                {
                    var eventByShortId = eventIdDictionary.Values.Where(ev => ev.ShortId == evt.Id).ToList();
                    if (eventByShortId.Count == 0)
                    {
                        notfound += 1;
                        _output.WriteLine($"Could not find event matching id {evt.Id} for provider {evt.ProviderName}");
                        continue;
                    }
                    else if (eventByShortId.Count > 1)
                    {
                        notfound += 1;
                        _output.WriteLine($"Ambiguous id {evt.Id} for provider {evt.ProviderName}");
                    }

                    message = eventByShortId.First();
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