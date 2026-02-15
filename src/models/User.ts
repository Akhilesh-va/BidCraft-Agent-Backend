import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
  phone?: string;
  email?: string;
  googleId?: string;
  name?: string;
  picture?: string;
  verified: boolean;
  companyName?: string;
  techStack: string[];
  pricingModel?: string;
  baseRate?: number;
}

const ProviderSchema = new mongoose.Schema<IUser>({
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String },
  picture: { type: String },
  verified: { type: Boolean, default: false },
  companyName: { type: String },
  techStack: { type: [String], default: [] },
  pricingModel: { type: String },
  baseRate: { type: Number, default: 0 },
}, { timestamps: true });

const User = mongoose.model<IUser>('User', ProviderSchema);
export default User;

