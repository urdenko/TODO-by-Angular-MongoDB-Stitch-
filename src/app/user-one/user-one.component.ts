import { Component, ChangeDetectorRef } from '@angular/core';
import {
  Stitch,
  AnonymousCredential,
  StitchUser,
  RemoteMongoClient,
  RemoteMongoCollection
} from 'mongodb-stitch-browser-sdk';
import { FormControl } from '@angular/forms';
import {
  MongoDBStitch_APPID,
  MongoDBStitch_DBName,
  MongoDBStitch_ProjectName,
  MongoDBStitch_TODO_Collection
} from '../app-client.const';

interface ObjectId {
  generationTime: number;
  id: Uint8Array;
}

interface Note {
  _id: ObjectId;
  /** id owners as access permission */
  owner_id: string;
  note: string;
  date: Date;
}
/**
 * Storing TODO list by MongoDB Stitch
 */

@Component({
  selector: 'app-user-one',
  templateUrl: './user-one.component.html',
  styleUrls: ['./user-one.component.scss']
})
export class UserOne {
  public user: StitchUser;

  private todoCollection: RemoteMongoCollection<Note>;

  public noteControl = new FormControl();

  public todoList: Note[] = [];

  public editingNow: number;
  public editControl = new FormControl();

  constructor(private changeDetector: ChangeDetectorRef) {}

  public login(): void {
    const client = Stitch.initializeDefaultAppClient(MongoDBStitch_APPID);

    client.auth
      .loginWithCredential(new AnonymousCredential())
      .then(user => {
        this.user = user;
        const mongoClient = Stitch.defaultAppClient.getServiceClient(
          RemoteMongoClient.factory,
          MongoDBStitch_ProjectName
        );
        this.todoCollection = mongoClient.db(MongoDBStitch_DBName).collection(MongoDBStitch_TODO_Collection);

        this.watchToNotes();
        this.loadFullNoteList();
      })
      .catch(console.error);
  }

  public addNote(): void {
    const note = this.noteControl.value as string;
    if (!note) {
      return;
    }

    this.todoCollection.insertOne(<Note>{ owner_id: this.user.id, note, date: new Date() }).then(() => {
      this.noteControl.reset();
    });
  }

  public removeNote(note: Note): void {
    this.todoCollection.deleteOne(note).catch(console.error);
  }

  public editNote(note: Note, NoteText: string): void {
    this.todoCollection.updateOne(<Note>{ _id: note._id }, { $set: { note: NoteText } }).catch(console.error);
  }

  public startToEditNote(index: number, note: Note): void {
    this.editingNow = this.editingNow === index ? null : index;
    this.editControl.setValue(note.note);
    this.changeDetector.detectChanges();
  }

  public cancelEdit(): void {
    this.editingNow = null;
    this.editControl.reset();
    this.changeDetector.detectChanges();
  }

  /** subscribe to collection chanage by SSE */
  private watchToNotes(): void {
    this.todoCollection.watch().then(stream => {
      stream.addListener({
        onNext: event => {
          switch (event.operationType) {
            case 'insert':
              this.insertNote(event.fullDocument);
              break;

            case 'delete':
              this.deleteNote(event.documentKey['_id']);
              break;

            case 'update':
              this.updateNote(event.fullDocument);
              break;

            default:
              this.loadFullNoteList();
              break;
          }
        },
        onError: console.error
      });
    });
  }

  private loadFullNoteList(): void {
    this.todoCollection
      .find()
      .asArray()
      .then(list => {
        this.todoList = list;
        this.changeDetector.detectChanges();
      });
  }

  private insertNote(note: Note): void {
    this.todoList.push(note);
    this.changeDetector.detectChanges();
  }

  private deleteNote(documentKey: ObjectId): void {
    this.todoList = this.todoList.filter(note => note._id.id.toLocaleString() !== documentKey.id.toLocaleString());
    this.changeDetector.detectChanges();
  }

  private updateNote(updateNote: Note): void {
    this.todoList = this.todoList.map(note => {
      if (note._id.id.toLocaleString() === updateNote._id.id.toLocaleString()) {
        return updateNote;
      }

      return note;
    });

    this.changeDetector.detectChanges();
  }
}
