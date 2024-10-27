import { Typography } from "adwavecss";

export type ImagesViewProps = {
  images: Array<{
    url: string;
    alt: string;
  }>;
};

export function ImagesView({ images }: ImagesViewProps) {
  return (
    <div class="images-view frame">
      {images.map(({ alt, url }) => {
        return (
          <div class="column img-container">
            <img src={url} alt={alt} title={alt} />
            <p class={Typography.subtitle}>{alt}</p>
          </div>
        );
      })}
    </div>
  );
}
