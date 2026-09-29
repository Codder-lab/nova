import mongoose, { Document, Schema } from 'mongoose';
import { ReminderStatus } from '@nova/shared';

export interface IReminder extends Document {
  id: string;
  userId: string;
  title: string;
  description?: string;
  remindAt: Date;
  status: ReminderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    remindAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'triggered', 'cancelled'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

ReminderSchema.index({ userId: 1, status: 1 });
ReminderSchema.index({ remindAt: 1, status: 1 });

export const Reminder = mongoose.model<IReminder>('Reminder', ReminderSchema);
