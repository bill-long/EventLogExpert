using System;
using System.Linq;
using EventLogExpert;
using Xunit;
using Xunit.Abstractions;

namespace EventUtils.Test
{
    public class RegistryProviderTests
    {
        public RegistryProviderTests(ITestOutputHelper output)
        {
            _output = output;
        }

        private readonly ITestOutputHelper _output;

        [Fact]
        public void GetMessageFilesForLegacyProviderWorks()
        {
            // Arrange
            var rp = new RegistryProvider(null, _output.WriteLine);

            // Act
            var result = rp.GetMessageFilesForLegacyProvider("Application Error").ToList();

            // Assert
            Assert.Single(result);
            Assert.Equal("C:\\windows\\system32\\wer.dll", result.First(), StringComparer.OrdinalIgnoreCase);
        }

        [Fact]
        public void GetMessageFilesForRemoteLegacyProviderWorks()
        {
            // Arrange
            var rp = new RegistryProvider(Environment.MachineName, _output.WriteLine);

            // Act
            var result = rp.GetMessageFilesForLegacyProvider("Application Error").ToList();

            // Assert
            Assert.Single(result);
            Assert.Equal($"\\\\{Environment.MachineName}\\C$\\windows\\system32\\wer.dll", result.First(),
                StringComparer.OrdinalIgnoreCase);
        }

        [Fact]
        public void GetRemoteSystemRootWorks()
        {
            // Arrange
            var rp = new RegistryProvider(Environment.MachineName, _output.WriteLine);

            // Act
            var result = rp.GetSystemRoot();

            // Assert
            Assert.Equal(result, Environment.ExpandEnvironmentVariables("%SystemRoot%"));
        }

        [Fact]
        public void GetSystemRootWorks()
        {
            // Arrange
            var rp = new RegistryProvider(null, _output.WriteLine);

            // Act
            var result = rp.GetSystemRoot();

            // Assert
            Assert.Equal(result, Environment.ExpandEnvironmentVariables("%SystemRoot%"));
        }
    }
}