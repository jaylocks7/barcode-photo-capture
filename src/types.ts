export type View = 'front' | 'back';

export type ItemRecord = {
  barcode: string;
  name: string;
  price?: number;                   // optional, set at first capture
  needs_photos: boolean;            // derived at write time
  required_views: View[];           // any subset of ["front", "back"]
  photo_urls: Partial<Record<View, string>>;     // view -> bg-removed S3 URL
  created_at: string;               // ISO 8601
  updated_at: string;               // ISO 8601
};

export type GetItemResponse =
  | { exists: true; item: ItemRecord }
  | { exists: false; suggestion: { name: string } };

export type PostPhotoResponse = {
  processedUrl: string;
  item: ItemRecord;
};