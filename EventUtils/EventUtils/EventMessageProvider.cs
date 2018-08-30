using System;
using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Linq;
using System.Runtime.InteropServices;

namespace EventLogExpert
{
    /// <summary>
    ///     Represents an event provider from a particular machine.
    /// </summary>
    public class EventMessageProvider
    {
        private readonly string _providerName;
        private readonly RegistryProvider _registryProvider;
        private readonly Action<string> _traceAction;

        public EventMessageProvider(string providerName, Action<string> traceAction) : this(providerName, null,
            traceAction)
        {
        }

        public EventMessageProvider(string providerName, string computerName, Action<string> traceAction)
        {
            _providerName = providerName;
            _traceAction = traceAction;
            _registryProvider = new RegistryProvider(computerName, _traceAction);
        }

        public IEnumerable<Message> LoadMessages()
        {
            var legacyMessages = LoadMessagesFromLegacyProvider();
            var modernMessages = LoadMessagesFromModernProvider();
            return legacyMessages.Concat(modernMessages);
        }

        /// <summary>
        ///     Loads the messages for a legacy provider from the files specified in
        ///     the registry. This information is stored at HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\EventLog
        /// </summary>
        /// <returns></returns>
        private IEnumerable<Message> LoadMessagesFromLegacyProvider()
        {
            _traceAction($"LoadMessagesFromLegacyProvider called for provider {_providerName}");

            var legacyProviderFiles = _registryProvider.GetMessageFilesForLegacyProvider(_providerName);

            if (legacyProviderFiles == null)
            {
                _traceAction($"No message files found for provider {_providerName}. Returning 0 messages.");
                return new Message[0];
            }

            var messages = new List<Message>();
            foreach (var file in legacyProviderFiles)
                try
                {
                    // https://stackoverflow.com/questions/33498244/marshaling-a-message-table-resource
                    var hModule = NativeMethods.LoadLibrary(file);
                    var msgTableInfo =
                        NativeMethods.FindResource(hModule, 1, NativeMethods.RT_MESSAGETABLE);
                    var msgTable = NativeMethods.LoadResource(hModule, msgTableInfo);
                    var memTable = NativeMethods.LockResource(msgTable);

                    var numberOfBlocks = Marshal.ReadInt32(memTable);
                    var blockPtr = IntPtr.Add(memTable, 4);
                    var blockSize = Marshal.SizeOf<NativeMethods.MESSAGE_RESOURCE_BLOCK>();

                    for (var i = 0; i < numberOfBlocks; i++)
                    {
                        var block = Marshal.PtrToStructure<NativeMethods.MESSAGE_RESOURCE_BLOCK>(blockPtr);
                        var entryPtr = IntPtr.Add(memTable, block.OffsetToEntries);
                        for (var id = block.LowId; id <= block.HighId; id++)
                        {
                            var length = Marshal.ReadInt16(entryPtr);
                            var flags = Marshal.ReadInt16(entryPtr, 2);
                            var textPtr = IntPtr.Add(entryPtr, 4);
                            string text;
                            if (flags == 0)
                                text = Marshal.PtrToStringAnsi(textPtr);
                            else if (flags == 1)
                                text = Marshal.PtrToStringUni(textPtr);
                            else
                                text = "Error: Bad flags. Could not get text.";

                            // This is an event
                            messages.Add(new Message
                            {
                                Text = text,
                                ShortId = (short) id,
                                ProviderName = _providerName,
                                RawId = id
                            });

                            // Advance to the next id
                            entryPtr = IntPtr.Add(entryPtr, length);
                        }

                        // Advance to the next block
                        blockPtr = IntPtr.Add(blockPtr, blockSize);
                    }

                    NativeMethods.FreeLibrary(hModule);
                }
                catch (Exception ex)
                {
                    _traceAction($"Exception loading legacy provider {_providerName}: {ex}");
                }

            _traceAction($"Returning {messages.Count} messages for provider {_providerName}");
            return messages;
        }

        /// <summary>
        ///     Loads the messages for a modern provider. This info is stored at
        ///     Computer\HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\WINEVT
        /// </summary>
        /// <returns></returns>
        private IEnumerable<Message> LoadMessagesFromModernProvider()
        {
            _traceAction($"LoadMessagesFromModernProvider called for provider {_providerName}");

            ProviderMetadata providerMetadata;
            try
            {
                providerMetadata = new ProviderMetadata(_providerName);

                if (providerMetadata.Id == Guid.Empty)
                {
                    _traceAction($"Provider {_providerName} has no provider GUID. Returning 0 messages.");
                    return new Message[0];
                }
            }
            catch (Exception ex)
            {
                _traceAction($"Exception loading provider metadata for {_providerName}: {ex}");
                _traceAction("Returning 0 messages.");
                return new Message[0];
            }

            var messages = new List<Message>();
            try
            {
                messages.AddRange(providerMetadata.Tasks.Select(t => new Message
                {
                    Text = t.DisplayName ?? t.Name,
                    ShortId = (short) t.Value,
                    ProviderName = _providerName,
                    RawId = t.Value
                }));

                messages.AddRange(providerMetadata.Events.Select(ev => new Message
                {
                    Text = ev.Description,
                    ShortId = (short) ev.Id,
                    ProviderName = _providerName,
                    RawId = ev.Id,
                    LogLink = ev.LogLink?.LogName,
                    Template = ev.Template
                }));
            }
            catch (Exception ex)
            {
                _traceAction($"Exception loading modern provider {_providerName}: {ex}");
            }

            _traceAction($"Returning {messages.Count} for provider {_providerName}");
            return messages;
        }
    }
}