﻿using System;
using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Linq;
using System.Threading.Tasks;

namespace EventLogExpert
{
    public class ProviderReader
    {
        public async Task<object> GetProviderNames(dynamic input)
        {
            var server = input.serverName;
            return await Task<object>.Factory.StartNew(() =>
            {
                var session = new EventLogSession(server);
                var providers = new List<string>(session.GetProviderNames().OrderBy(name => name));
                return providers;
            });
        }

        public async Task<object> LoadProviderMessages(dynamic input)
        {
            try
            {
                string server = input.serverName;
                string providerName = input.providerName;
                Func<object, Task<object>> logFunc = input.logFunc;
                void Logger(string s) => logFunc(s);
                return await Task<object>.Factory.StartNew(() =>
                {
                    try
                    {
                        var p = new EventMessageProvider(providerName, server, Logger);
                        return p.LoadMessages();
                    }
                    catch (Exception ex)
                    {
                        return Task.FromResult(ex);
                    }
                });
            }
            catch (Exception ex)
            {
                return Task.FromResult(ex);
            }
        }
    }
}
