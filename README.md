# EventLogExpert

## This version of the tool is no longer maintained. Please find the new one here: https://github.com/microsoft/EventLogExpert

A Windows Event Log viewer for IT professionals and power users.

## Build status

[![Build Status](https://dev.azure.com/ExchangeEETeam/EventLogExpert/_apis/build/status/bill-long.EventLogExpert?branchName=master)](https://dev.azure.com/ExchangeEETeam/EventLogExpert/_build/latest?definitionId=18&branchName=master)

## Dependencies

* [.NET 4.7.2](https://support.microsoft.com/en-us/help/4054531/microsoft-net-framework-4-7-2-web-installer-for-windows)

## Contributing

### Prerequisites

1. Install Angular Cli 11+:

	`npm install -g @angular/cli`

2. Install Node.js Version 12+
3. Install the Dotnet Core 2.1 SDK:

	https://www.microsoft.com/net/download/windows

4. Install the .NET 4.7.2 Developer Pack:

	https://dotnet.microsoft.com/download/dotnet-framework/net472

### Building and Testing

1. Change into the Electron Folder run: 

	`npm install`

2. When that finishes you should be able to run:

	`npm start`

	This step will build the dotnet DLL, copy it into the Electron folder, and start the Electron app.
