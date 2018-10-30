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

        /// <summary>
        /// Note this method is synchronous and must be called synchronously
        /// from NodeJS.
        /// </summary>
        /// <param name="input"></param>
        /// <returns>A delegate that must be called asychronously from NodeJS</returns>
        public Task<object> GetActiveEventLogReader(dynamic input)
        {
            var logName = input.logName;
            var reader = new EventLogReader(logName, PathType.LogName);
            var readComplete = false;

            // The delegate returned is async
            return Task.FromResult((object) (Func<object, Task<object>>) (async o =>
            {
                if (readComplete) return null;

                return await Task<object>.Factory.StartNew(() =>
                {
                    var count = 0;
                    var events = new List<object>();
                    EventRecord evt;
                    while (count < BatchSize && null != (evt = reader.ReadEvent()))
                    {
                        count++;

                        events.Add(new
                        {
                            evt.Id,
                            evt.Qualifiers,
                            evt.LogName,
                            evt.MachineName,
                            evt.Level,
                            evt.TimeCreated,
                            evt.ProviderName,
                            evt.Task,
                            evt.Opcode,
                            User = evt.UserId?.Value,
                            evt.RecordId,
                            Properties = evt.Properties.Select(p =>
                            {
                                if (p.Value is byte[] a)
                                {
                                    return string.Join("", a.Select(element => element.ToString("X2")));
                                }

                                return p.Value.ToString();
                            })
                        });
                    }

                    if (count < 1)
                    {
                        readComplete = true;
                        reader.Dispose();
                        return null;
                    }

                    if (count < BatchSize)
                    {
                        readComplete = true;
                        reader.Dispose();
                    }

                    return events;
                });
            }));
        }

        /// <summary>
        /// Note this method is synchronous and must be called synchronously
        /// from NodeJS.
        /// </summary>
        /// <param name="input"></param>
        /// <returns>A delegate that must be called asychronously from NodeJS</returns>
        public Task<object> GetEventLogFileReader(dynamic input)
        {
            var file = input.file;
            var reader = new EventLogReader(file, PathType.FilePath);
            var readComplete = false;

            // The delegate returned is async
            return Task.FromResult((object) (Func<object, Task<object>>) (async o =>
            {
                if (readComplete) return null;

                return await Task<object>.Factory.StartNew(() =>
                {
                    var count = 0;
                    var events = new List<object>();
                    EventRecord evt;
                    while (count < BatchSize && null != (evt = reader.ReadEvent()))
                    {
                        count++;
                        events.Add(new
                        {
                            evt.Id,
                            evt.Qualifiers,
                            evt.LogName,
                            evt.MachineName,
                            evt.Level,
                            evt.TimeCreated,
                            evt.ProviderName,
                            evt.Task,
                            evt.Opcode,
                            User = evt.UserId?.Value,
                            evt.RecordId,
                            Properties = evt.Properties.Select(p =>
                            {
                                if (p.Value is byte[] a)
                                {
                                    return string.Join("", a.Select(element => element.ToString("X2")));
                                }

                                return p.Value.ToString();
                            })
                        });
                    }

                    if (count < 1)
                    {
                        readComplete = true;
                        reader.Dispose();
                        return null;
                    }

                    if (count < BatchSize)
                    {
                        readComplete = true;
                        reader.Dispose();
                    }

                    return events;
                });
            }));
        }
    }
}