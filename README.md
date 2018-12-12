# EventLogExpert

A Windows Event Log viewer for IT professionals and power users.

## Build status

[![Build Status](https://exchangeeeteam.visualstudio.com/EventLogExpert/_apis/build/status/EventLogExpert-CI)](https://exchangeeeteam.visualstudio.com/EventLogExpert/_build/latest?definitionId=9)

## Contributing

### Prerequisites

1. Install Angular Cli 6+:

	`npm install -g @angular/cli`

2. Install Node.js Version 8+
3. Install the Dotnet Core 2.1 SDK:

	https://www.microsoft.com/net/download/windows

4. Install the .NET 4.7.1 Targeting Pack:

	https://www.microsoft.com/en-us/download/details.aspx?id=56119

### Building and Testing

1. Change into the Electron Folder run: 

	`npm install`

2. When that finishes you should be able to run:

	`npm start`

	This step will build the dotnet DLL, copy it into the Electron folder, and start the Electron app.
