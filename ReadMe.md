#Prerequisites 
1. Install Angular Cli 6+
	npm install -g @angular/cli
2. Install Node.js Version 8+
3. Install donnet core 2.1 

https://www.microsoft.com/net/download/windows



#Building and Testing

1. Change into EventLogExpert\EventUtils and run: dotnet build 
2. Copy the DLL from EventUtils to Electron folder 

	Copy-Item .\EventUtils\bin\Debug\net471\EventLogExpert.dll ..\Electron\

3. Change into the Electron Folder run: 

npm install 

when that finishes you should be able to run:

npm start 