import mongoose from 'mongoose';

const redemptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const activationCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    batchLabel: { type: String, required: true },
    // null means the enrollment it creates is permanent
    durationDays: { type: Number, default: null },
    maxUses: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0 },
    redeemedBy: { type: [redemptionSchema], default: [] },
    // when the code itself stops being redeemable (null = never)
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'activation_codes' },
);

activationCodeSchema.index({ courseId: 1, batchLabel: 1 });

export const ActivationCode = mongoose.model('ActivationCode', activationCodeSchema);
