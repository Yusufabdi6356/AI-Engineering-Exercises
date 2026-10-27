import { Schema, model, models, type Model } from 'mongoose';

interface ConversationFields {
  _id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationFields>(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true, default: 'New Conversation' },
  },
  { timestamps: true },
);

export const Conversation =
  (models.Conversation as Model<ConversationFields>) ||
  model<ConversationFields>('Conversation', conversationSchema);
