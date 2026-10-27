import { Schema, model, models, type Model } from 'mongoose';

export type Feedback = 'up' | 'down';

interface MessageFields {
  _id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  position: number;
  model?: string;
  feedback: Feedback | null;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageFields>(
  {
    _id: { type: String, required: true },
    conversationId: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, default: '' },
    position: { type: Number, required: true },
    model: String,
    feedback: { type: String, enum: ['up', 'down', null], default: null },
  },
  { timestamps: true },
);

export const Message =
  (models.Message as Model<MessageFields>) || model<MessageFields>('Message', messageSchema);
