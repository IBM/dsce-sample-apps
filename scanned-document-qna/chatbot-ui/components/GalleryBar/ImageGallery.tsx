import {useTranslation} from 'next-i18next';
import {useSelectedImage} from "@/components/GalleryBar/SelectedImageContext";
import {ImageThumbnail} from "@/components/GalleryBar/ImageThumbnail";
import {useEffect, useState} from "react";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type ImageGalleryProps = {
    onImageChange: (arg0: string) => void;
    onClose: any;
};

export const ImageGallery: React.FC<ImageGalleryProps> = ({onImageChange, onClose}) => {
    const {t} = useTranslation('sidebar');
    const {selectedImage, setSelectedImage} = useSelectedImage();
    const [images, setImages] = useState([]);

    useEffect(() => {
        fetch(`${API_URL}/api/get_images_list`)
            .then(response => response.json())
            .then(data => setImages(data))
            .catch(error => {
                toast(error);
                console.error('Error fetching image list:', error);
            });
    }, []);

    return (
        <div className="gallery-container">
            <div className="drawer-title-container">
                <p className="drawer-title-text">Select an image to chat</p>
                <div className={"mr-7"}>
                    {onClose}
                </div>
            </div>

            <div className="images-grid">
                {images.map((imageName: string, index) => (
                    <div
                        key={index}
                        className={`image-card min-w-[120px] flex flex-col justify-between items-center p-2 ${imageName === selectedImage ? 'selected-image' : ''}`}
                        onClick={() => {
                            setSelectedImage(imageName);
                        }}
                    >
                        <div className="w-32 mb-2">
                            <p className="image-name text-xs break-all">{imageName.split('.')[0]}</p>
                        </div>
                        <div className="thumbnail-container mt-5 flex-grow flex items-end justify-center"
                             title={imageName}>
                            <ImageThumbnail src={API_URL + `/static/images/${imageName}`}
                                            alt={`Thumbnail ${index + 1}`}/>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>
                {`
                  .gallery-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20px;
                    background-color: #1a1a1a;
                    color: white;
                     overflow-y: scroll;
                    max-height: 90vh;
                  }

                  .drawer-title-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                    margin-bottom: 20px;
                  }

                  .images-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                max-width: calc(100% - 40px); // adjust the 40px to account for padding/margins if necessary
                overflow-y: auto; // Enable vertical scrolling
              }

              .image-card {
                flex-basis: calc(33.333% - 20px); // Deduct the gap size from the width
                background-color: #2c2c2c;
                padding: 10px;
                cursor: pointer;
                transition: background-color 0.3s ease;
                // Add a max-width if you have a specific size for the cards
                max-width: calc((100% / 3) - 20px); // Adjust as needed
              }

                  .image-card:hover {
                    background-color: rgba(49, 59, 80, 0.94);
                  }

                  .selected-image {
                    background-color: #007aff;
                  }


                  .thumbnail-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                  }
                `}
            </style>
        </div>
    );
};
