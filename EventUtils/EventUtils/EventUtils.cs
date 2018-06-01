using System;
using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace EventLogExpert.EventUtils
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
                        if (!_providerDictionary.TryGetValue(evt.ProviderName, out ProviderMetadata providerMetadata))
                        {
                            var metadata = new ProviderMetadata(evt.ProviderName, _session, CultureInfo.CurrentCulture);
                            _providerDictionary.Add(evt.ProviderName, metadata);
                            providerMetadata = metadata;
                        }

                        var evt1 = evt;
                        var providerEvent = providerMetadata.Events.FirstOrDefault(e => e.Id == evt1.Id);

                        events.Add(new
                        {
                            evt.Id,
                            evt.LogName,
                            evt.MachineName,
                            evt.Level,
                            evt.TimeCreated,
                            evt.ProviderName,
                            Category = providerEvent?.Task.Name,
                            providerEvent?.Description,
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
