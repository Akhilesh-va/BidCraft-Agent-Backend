import mongoose, { Document } from 'mongoose';

export interface IRFP extends Document {
  clientName?: string;
  rawText?: string;
  budget?: number;
  deadline?: Date;
  requirements: string[];
  status: 'Uploaded' | 'Processing' | 'Completed';
  generatedProposal?: any;
}

const RFPSchema = new mongoose.Schema<IRFP>({
  clientName: { type: String },
  rawText: { type: String },
  budget: { type: Number },
  deadline: { type: Date },
  requirements: { type: [String], default: [] },
  status: {
    type: String,
    enum: ['Uploaded', 'Processing', 'Completed'],
    default: 'Uploaded'
  },
  generatedProposal: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

const RFP = mongoose.model<IRFP>('RFP', RFPSchema);
export default RFP;

