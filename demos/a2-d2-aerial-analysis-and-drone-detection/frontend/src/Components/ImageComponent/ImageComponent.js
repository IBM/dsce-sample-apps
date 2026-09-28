// src/Components/ImageComponent/ImageComponent.js
import React, { useEffect, useState } from 'react';
import styles from './ImageComponent.module.scss';
import { useData } from '../../DataContext';

const ImageComponent = () => {
	const { currentImage, setCurrentImage, masterData, selectedRow } = useData();

	const [imageError, setImageError] = useState(false);
	useEffect(() => {
		if (!selectedRow) return;

		const wrapper = masterData[selectedRow];
		const drone = wrapper?.drone || (masterData[selectedRow] && masterData[selectedRow].lat ? masterData[selectedRow] : null);
		if (!drone) return;

		let imgPath = null;
		if (drone.imagePath) {
			imgPath = drone.imagePath.startsWith('/') ? drone.imagePath : '/' + drone.imagePath;
		} else if (drone.drone_type || drone.droneType) {
			const type = drone.drone_type || drone.droneType;
			imgPath = `/drone_images/${type}.png`;
		}
		console.log(imgPath);

		setImageError(false); 
		if (currentImage !== imgPath) {
			setCurrentImage(imgPath);
		}
	}, [selectedRow, masterData, setCurrentImage, currentImage]);

	if (!selectedRow) {
		return <div className={styles.noImage}>No Drone Selected</div>;
	}

	if (!currentImage || imageError) {
		return <div className={styles.noImage}>No Drone Image Available</div>;
	}

	return (
		<div>
			<img
				src={currentImage}
				alt='drone'
				className={styles.image}
				onError={() => setImageError(true)}
			/>
		</div>
	);
};

export default React.memo(ImageComponent);
