using System;
using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Linq;
using System.Threading.Tasks;

namespace EventLogExpert
{
    /// <summary>
    ///     This class is called from NodeJS in order to read an event log.
    ///     NodeJS should call:
    ///     GetActiveEventLogReader - to read an active log like Application
    ///     GetEventLogFileReader - to read an evtx file
    ///     The returned delegate can be called repeatedly to read events
    ///     until all events have been read. By exporting a delegate to NodeJS,
    ///     we are able to expose the state of this class (and keep track of
    ///     our position in the log) even though NodeJS has no direct access to
    ///     the state.
    /// </summary>
    public class EventReader
    {
        private const int BatchSize = 1000;

        public async Task<object> GetActiveEventLogReader(dynamic input)
        {
            var logName = input.logName;
            var reader = new EventLogReader(logName, PathType.LogName);
            var readComplete = false;

            return new
            {
                reader = (Func<object, Task<object>>) (async o =>
                {
                    if (readComplete) return null;

                    var count = 0;
                    var events = new List<object>();
                    EventRecord evt;
                    while (count < BatchSize && null != (evt = reader.ReadEvent()))
                    {
                        count++;

                        events.Add(new
                        {
                            evt.Id,
                            evt.LogName,
                            evt.MachineName,
                            evt.Level,
                            evt.TimeCreated,
                            evt.ProviderName,
                            evt.Task,
                            Properties = evt.Properties.Select(p => p.Value)
                        });
                    }

                    if (count < BatchSize)
                    {
                        readComplete = true;
                        reader.Dispose();
                    }

                    return events;
                })
            };
        }

        public async Task<object> GetEventLogFileReader(dynamic input)
        {
            var file = input.file;
            var reader = new EventLogReader(file, PathType.FilePath);
            var readComplete = false;

            return new
            {
                reader = (Func<object, Task<object>>) (async o =>
                {
                    if (readComplete) return null;

                    var count = 0;
                    var events = new List<object>();
                    EventRecord evt;
                    while (count < BatchSize && null != (evt = reader.ReadEvent()))
                    {
                        count++;
                        events.Add(new
                        {
                            evt.Id,
                            evt.LogName,
                            evt.MachineName,
                            evt.Level,
                            evt.TimeCreated,
                            evt.ProviderName,
                            evt.Task,
                            Properties = evt.Properties.Select(p => p.Value)
                        });
                    }

                    if (count < BatchSize)
                    {
                        readComplete = true;
                        reader.Dispose();
                    }

                    return events;
                })
            };
        }
    }
}