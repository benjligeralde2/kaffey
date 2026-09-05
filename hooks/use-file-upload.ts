import { useCallback, useRef, useState } from "react";

type UploadFile = {
	id: string;
	file: File;
	preview: string;
};

type FileUploadOptions = {
	accept?: string;
	maxSize?: number;
	onFilesChange?: (files: UploadFile[]) => void;
};

export function useFileUpload({ accept, maxSize, onFilesChange }: FileUploadOptions = {}) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [files, setFiles] = useState<UploadFile[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const [errors, setErrors] = useState<string[]>([]);

	const updateFiles = useCallback((nextFiles: UploadFile[]) => {
		setFiles(nextFiles);
		onFilesChange?.(nextFiles);
	}, [onFilesChange]);

	const addFiles = useCallback((fileList: FileList | File[]) => {
		const nextFile = Array.from(fileList)[0];
		if (!nextFile) return;
		if (accept && !accept.split(",").some((type) => nextFile.type === type.trim())) {
			setErrors(["Please choose an image file."]);
			return;
		}
		if (maxSize && nextFile.size > maxSize) {
			setErrors([`The image must be smaller than ${Math.round(maxSize / 1024 / 1024)}MB.`]);
			return;
		}
		setErrors([]);
		const uploadFile = { id: `${nextFile.name}-${nextFile.lastModified}`, file: nextFile, preview: URL.createObjectURL(nextFile) };
		updateFiles([uploadFile]);
	}, [accept, maxSize, updateFiles]);

	const handleDragEnter = (event: React.DragEvent<HTMLElement>) => {
		event.preventDefault();
		setIsDragging(true);
	};
	const handleDragLeave = (event: React.DragEvent<HTMLElement>) => {
		event.preventDefault();
		setIsDragging(false);
	};
	const handleDragOver = (event: React.DragEvent<HTMLElement>) => event.preventDefault();
	const handleDrop = (event: React.DragEvent<HTMLElement>) => {
		event.preventDefault();
		setIsDragging(false);
		addFiles(event.dataTransfer.files);
	};
	const openFileDialog = () => inputRef.current?.click();
	const removeFile = (id?: string) => {
		const nextFiles = files.filter((file) => file.id !== id);
		files.filter((file) => file.id === id).forEach((file) => URL.revokeObjectURL(file.preview));
		updateFiles(nextFiles);
		setErrors([]);
	};
	const getInputProps = () => ({
		ref: inputRef,
		accept,
		type: "file" as const,
		onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
			if (event.target.files) addFiles(event.target.files);
			event.target.value = "";
		},
	});

	return [{ files, isDragging, errors }, { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, removeFile, getInputProps }] as const;
}