using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Runtime.Serialization.Json;
using EventLogExpert;
using Xunit;
using Xunit.Abstractions;

namespace EventUtils.Test
{
    public class EventLogReaderTests
    {
        public EventLogReaderTests(ITestOutputHelper output)
        {
            _output = output;
        }

        private readonly ITestOutputHelper _output;

        [Fact]
        public async void ReadSystemLogWorks()
        {
            // Arrange
            dynamic input = new ExpandoObject();
            input.logName = "System";
            var reader = new EventReader();
            var activeLogReader = await reader.GetActiveEventLogReader(input);

            // Act
            var allResults = new List<object>();
            List<object> result;
            var batches = 0;
            do
            {
                batches++;
                result = await activeLogReader(null) as List<object>;
                if (result != null) allResults.AddRange(result);
            } while (result != null && result.Any());

            // Assert
            _output.WriteLine($"Got {batches} batches and loaded {allResults.Count} messages");
            Assert.True(allResults.Count > 0);
        }
    }
}
