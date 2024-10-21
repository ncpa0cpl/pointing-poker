import { StatusCodes } from "http-status-codes";
import { RequestError } from "../utilities/request-error";
import { Room } from "./room/room";

const MAX_ACTIVE_ROOMS = 3;

export class RoomService {
  private static rooms: Room[] = [];

  public static putRoom(room: Room): void {
    this.rooms.push(room);
  }

  public static createRoom(ownerID: string, ownerName: string): Room | null {
    if (this.rooms.length >= MAX_ACTIVE_ROOMS) {
      this.purgeStaleRooms();
      if (this.rooms.length >= MAX_ACTIVE_ROOMS) {
        return null;
      }
    }

    const room = new Room(ownerID, ownerName);
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
    const [room] = this.rooms.splice(idx, 1);
    room?.dispose();
  }

  private static purgeStaleRooms(): void {
    for (let i = this.rooms.length - 1; i >= 0; i--) {
      const room = this.rooms[i]!;
      if (room.isStale()) {
        this.removeRoom(room.id);
      }
    }
  }

  static {
    setInterval(() => this.purgeStaleRooms(), 1000 * 60);
  }
}
