import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  messageDatabaseFilename = 'Messages.db';
  db: Nedb;

  constructor(private electronService: ElectronService) {
    this.db = new electronService.nedb({ filename: this.messageDatabaseFilename, autoload: true });
  }

  addMessages(messages: any) {
    this.db.insert(messages);
  }

  getAllMessages() {
    return this.db.getAllData();
  }

  async getMessages(provider: string, rawId: number) {
    return await this.db.find({ ProviderName: provider, RawId: rawId });
  }
}
