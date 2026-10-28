import mongoose from 'mongoose';
import { ROLES, USER_STATUS, DEFAULT_MAX_DEVICES } from '@lp/shared';

// Devices are embedded: there are only 2–3 per account and they are always read with the user.
const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true },
    name: { type: String, default: '' },
    platform: { type: String, enum: ['ios', 'android', 'web', 'other'], default: 'other' },
    addedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    maxDevices: { type: Number, default: DEFAULT_MAX_DEVICES, min: 1, max: 10 },
    devices: { type: [deviceSchema], default: [] },
    // Last self-service device swap at login (rate-limited by DEVICE_REPLACE_COOLDOWN_DAYS).
    lastDeviceReplaceAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ role: 1, createdAt: -1 });

userSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    name: this.name,
    phone: this.phone,
    role: this.role,
    status: this.status,
    maxDevices: this.maxDevices,
    devices: this.devices.map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      platform: d.platform,
      addedAt: d.addedAt,
      lastSeenAt: d.lastSeenAt,
    })),
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
