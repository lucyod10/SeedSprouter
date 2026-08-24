import { Image, ImageProps } from 'expo-image';
import { resolveMediaUri } from '../services/media';

type GardenImageProps = Omit<ImageProps, 'source' | 'contentFit' | 'resizeMode'> & {
  uri: string;
  resizeMode?: 'cover' | 'contain';
  /** Keeps the original decode available while an editor magnifies the image. */
  highQuality?: boolean;
};

/** The only image view used for user-owned garden media. */
export function GardenImage({ uri, resizeMode = 'cover', highQuality = false, ...props }: GardenImageProps) {
  const resolvedUri = resolveMediaUri(uri);
  return (
    <Image
      {...props}
      source={{ uri: resolvedUri }}
      contentFit={resizeMode}
      allowDownscaling={!highQuality}
      // A thumbnail-sized decoded bitmap may already be in memory for this URI.
      // Editors use the encoded disk entry so expo-image decodes the source again
      // with downscaling disabled instead of reusing that thumbnail bitmap.
      cachePolicy={highQuality ? 'disk' : 'memory-disk'}
      priority={highQuality ? 'high' : 'normal'}
      recyclingKey={resolvedUri}
      transition={0}
    />
  );
}
