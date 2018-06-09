using System;
using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Linq;
using System.Threading.Tasks;

namespace EventLogExpert
{
    /// <summary>
    /// This class is called from NodeJS in order to read an event log.
    /// NodeJS should call:
    /// GetActiveEventLogReader - to read an active log like Application
    /// GetEventLogFileReader - to read an evtx file
    /// The returned delegate can be called repeatedly to read events
    /// until all events have been read. By exporting a delegate to NodeJS,
    /// we are able to expose the state of this class (and keep track of
    /// our position in the log) even though NodeJS has no direct access to
    /// the state.
    /// </summary>
    public class EventReader
    {
        private const int BATCH_SIZE = 8000;

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
                    while (count < BATCH_SIZE && null != (evt = reader.ReadEvent()))
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

                    if (count < BATCH_SIZE)
                    {
                        readComplete = true;
                        reader.Dispose();
                    }

                    return events;
                }),

                count = reader.LogStatus.Count
            };
        }

        public async Task<object> GetEventLogFileReader(dynamic input)
        {
            var file = input.file;
            var reader = new EventLogReader(file, PathType.FilePath) { BatchSize = 1000 };
            var readComplete = false;

            return new
            {
                reader = (Func<object, Task<object>>)(async o =>
                {
                    if (readComplete) return null;

                    var count = 0;
                    var events = new List<object>();
                    EventRecord evt;
                    while (count < 1000 && null != (evt = reader.ReadEvent()))
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

                    if (count < 1000)
                    {
                        readComplete = true;
                        reader.Dispose();
                    }

                    return events;
                }),

                count = reader.LogStatus.Count
            };
        }

        /// <summary>
        /// Read events from a live log such as Application
        /// </summary>
        /// <param name="input"></param>
        /// <returns></returns>
        public async Task<object> ReadEventsFromActiveLog(dynamic input)
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

        public async Task<object> ReadEventsFromFile(dynamic input)
        {
            var task = new Task<object>(() =>
            {
                var file = input.file;
                try
                {
                    var events = new List<object>();
                    var reader = new EventLogReader(file, PathType.FilePath) {BatchSize = 1000};
                    EventRecord evt;
                    while (null != (evt = reader.ReadEvent()))
                    {
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