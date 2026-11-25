import { StatusCodes } from "http-status-codes";
import { DateTime } from "luxon";
import { usage } from "../usage-log";
import { Storages } from "../utilities/persistent-objects/storage/storages";
import { RequestError } from "../utilities/request-error";
import { PERSISTENT_ROOM_RETIRE_AFTER_MIN } from "./room/constants";
import { Room } from "./room/room";
import type { SerializedRoom } from "./room/serializer";

const MAX_ACTIVE_ROOMS = 100;

export class RoomService {
  private static rooms: Room[] = [];
  // persistent rooms removed from memory but kept on disk, addressable by id
  private static retiredRoomIDs = new Set<string>();
  private static retiredRoomLoads = new Map<string, Promise<void>>();

  public static roomCount() {
    return this.rooms.length;
  }

  public static userCount() {
    return this.rooms.reduce((sum, room) => room.countUsers() + sum, 0);
  }

  public static putRoom(room: Room): void {
    this.rooms.push(room);
  }

  public static createRoom(
    ownerID: string,
    ownerName: string,
    persistent = false,
  ): Room | null {
    if (this.rooms.length >= MAX_ACTIVE_ROOMS) {
      this.purgeStaleRooms();
      if (this.rooms.length >= MAX_ACTIVE_ROOMS) {
        return null;
      }
    }

    const room = new Room(ownerID, ownerName, "voter", { persistent });
    usage.logStart("ROOM_CREATED");
    this.putRoom(room);
    return room;
  }

  public static getRoom(id: string): Room | RequestError {
    const room = this.rooms.find((room) => room.id === id);

    if (!room) {
      return new RequestError(
        StatusCodes.NOT_FOUND,
        `Room with id ${id} not found.`,
      );
    }

    return room;
  }

  public static getRooms(): Room[] {
    return this.rooms.slice();
  }

  public static removeRoom(id: string): void {
    const idx = this.rooms.findIndex((room) => room.id === id);
    if (idx === -1) {
      return;
    }
    const [room] = this.rooms.splice(idx, 1);
    room?.dispose();
  }

  public static isRetired(id: string): boolean {
    return this.retiredRoomIDs.has(id);
  }

  public static loadRetiredRoom(id: string): Promise<void> {
    const inFlight = this.retiredRoomLoads.get(id);
    if (inFlight) {
      return inFlight;
    }
    const load = this.readRetiredRoomFromDisk(id);
    this.retiredRoomLoads.set(id, load);
    return load;
  }

  private static async readRetiredRoomFromDisk(id: string): Promise<void> {
    try {
      const data = await Storages.get(Room.name, id);
      if (data) {
        Room.serializer.deserialize(data as SerializedRoom);
      }
      this.retiredRoomIDs.delete(id);
    } finally {
      this.retiredRoomLoads.delete(id);
    }
  }

  public static async loadRoomsFromDisk(): Promise<void> {
    const serializedRooms = await Storages.load(Room.name);
    for (const data of serializedRooms) {
      const room = data as SerializedRoom;
      if (!room.persistent) {
        Room.serializer.deserialize(room);
        continue;
      }
      // dormant persistent rooms are loaded from disk on demand, not at startup
      const lastActivity = DateTime.fromISO(room.lastActivity);
      if (
        lastActivity.diffNow("minutes").minutes
        > -PERSISTENT_ROOM_RETIRE_AFTER_MIN
      ) {
        Room.serializer.deserialize(room);
      } else {
        this.retiredRoomIDs.add(room.id);
      }
    }
  }

  private static retireRoom(id: string): void {
    const idx = this.rooms.findIndex((room) => room.id === id);
    if (idx === -1) {
      return;
    }
    this.rooms.splice(idx, 1);
    this.retiredRoomIDs.add(id);
  }

  private static purgeStaleRooms(): void {
    for (let i = this.rooms.length - 1; i >= 0; i--) {
      const room = this.rooms[i]!;
      if (room.isStale()) {
        this.removeRoom(room.id);
      } else if (room.isRetirable()) {
        this.retireRoom(room.id);
      }
    }
  }

  static {
    setInterval(() => this.purgeStaleRooms(), 1000 * 60);
  }
}
