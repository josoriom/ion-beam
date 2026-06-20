import { memo, useEffect, useRef } from "react";
import type { RenderedImage } from "../ms/ion_image";

interface IonImageCanvasProps {
  image: RenderedImage;
}

export const IonImageCanvas = memo(function IonImageCanvas({ image }: IonImageCanvasProps) {
  const canvas_ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvas_ref.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const pixels = context.createImageData(image.width, image.height);
    pixels.data.set(image.rgba);
    context.putImageData(pixels, 0, 0);
  }, [image]);

  return <canvas ref={canvas_ref} className="ion-canvas" />;
});
