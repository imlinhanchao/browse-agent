import { EntitySchema } from 'typeorm';

export interface InstanceData {
  id: string;
  name: string;
  secret: string;
  wsPort: number;
  createdAt: string;
}

export const InstanceSchema = new EntitySchema<InstanceData>({
  name: 'Instance',
  tableName: 'instances',
  columns: {
    id: { type: String, primary: true },
    name: { type: String },
    secret: { type: String },
    wsPort: { type: Number },
    createdAt: { type: String },
  },
});
