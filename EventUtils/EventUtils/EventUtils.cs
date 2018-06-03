using System;
using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace EventLogExpert
{
    public class EventUtils
    {
        private readonly EventLogSession _session = new EventLogSession();
        private readonly Dictionary<string, ProviderMetadata> _providerDictionary = new Dictionary<string, ProviderMetadata>();

        public async Task<object> ReadEvents(dynamic input)
        {
            var task = new Task<object>(() =>
            {
                var logName = input.logName;
                var serverName = input.serverName;

                try
                {
                    var events = new List<object>();
                    var reader = new EventLogReader(logName, PathType.LogName) {BatchSize = 1000};
                    EventRecord evt;
                    while (null != (evt = reader.ReadEvent()))
                    {
                        // Attempting to get the task display name throws for
                        // providers that are not properly registered, so
                        // wrap it in try/catch
                        string taskDisplayName;
                        try
                        {
                            taskDisplayName = evt.TaskDisplayName;
                        }
                        catch
                        {
                            taskDisplayName = "";
                        }

                        events.Add(new
                        {
                            evt.Id,
                            evt.LogName,
                            evt.MachineName,
                            evt.Level,
                            evt.TimeCreated,
                            evt.ProviderName,
                            Category = taskDisplayName,
                            Description = evt.FormatDescription(),
                            Properties = evt.Properties.Select(p => p.Value)
                        });
                    }

                    events.Reverse();
                    return events;
                }
                catch (Exception ex)
                {
                    return ex;
                }
            });

            task.Start();
            return await task;
        }
    }
}
