import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

type ZoomableImageProps = {
    src: string;
};

export const ZoomableImage: React.FC<ZoomableImageProps> = ({ src }) => {
    return (
        <TransformWrapper>
            <TransformComponent>
                <img
                    src={src}
                    alt="Selected Thumbnail"
                    className="w-full h-auto rounded-md border border-neutral-600 bg-[#202123] px-4 py-3 pr-10 text-[14px] leading-3 text-white"
                />
            </TransformComponent>
        </TransformWrapper>
    );
};
