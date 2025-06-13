import React, { useState, useCallback, useRef, useEffect } from "react";
import { IoIosDocument } from "react-icons/io";
import { IoClose } from "react-icons/io5";
import { IoIosArrowForward } from "react-icons/io";
import { PDFDocument } from 'pdf-lib';

interface FileWithPreview {
    id: string;
    name: string;
    file: File;
    preview?: string;
}

interface FileAdderProps {
    selectedOption: string | null;
}

function FileAdder({ selectedOption }: FileAdderProps) {
    const [files, setFiles] = useState<FileWithPreview[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [splitCount, setSplitCount] = useState<number>(2);
    const [pageCount, setPageCount] = useState<number | null>(null);
    const [splitPages, setSplitPages] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const MAX_FILES = 10;

    // Function to get page count
    const getPageCount = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            setPageCount(pdf.getPageCount());
        } catch (error) {
            console.error("Error getting page count:", error);
            setPageCount(null);
        }
    };

    // Update page count when file is added
    useEffect(() => {
        if (selectedOption === "split-pdf" && files.length > 0) {
            getPageCount(files[0].file);
        } else {
            setPageCount(null);
        }
    }, [files, selectedOption]);

    // Function to handle split page input
    const handleSplitPageChange = (index: number, value: string) => {
        // Only allow numbers
        if (!/^\d*$/.test(value)) return;

        // Convert to number and validate against page count
        const numValue = parseInt(value);
        if (value && (isNaN(numValue) || numValue <= 0 || (pageCount !== null && numValue >= pageCount))) {
            return;
        }

        const newSplitPages = [...splitPages];
        newSplitPages[index] = value;
        setSplitPages(newSplitPages);
    };

    // Update split pages array when split count changes
    useEffect(() => {
        if (selectedOption === "split-pdf") {
            const newSplitPages = Array(splitCount - 1).fill('');
            setSplitPages(newSplitPages);
        }
    }, [splitCount, selectedOption]);

    const showError = (message: string) => {
        setError(message);
        setTimeout(() => setError(null), 3000);
    };

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            file => file.type === 'application/pdf'
        );

        console.log('Dropped files:', droppedFiles.map(f => f.name));
        console.log('Current operation:', selectedOption);
        console.log('Current files:', files.map(f => f.name));

        if (selectedOption === 'merge-pdf') {
            if (files.length + droppedFiles.length > MAX_FILES) {
                showError(`You can only merge up to ${MAX_FILES} files at once.`);
                return;
            }
        } else if (files.length + droppedFiles.length > 1) {
            showError('You can only select one file for this operation.');
            return;
        }

        const newFiles = droppedFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            file: file,
            preview: URL.createObjectURL(file)
        }));

        console.log('New files to be added:', newFiles.map(f => f.name));
        setFiles(prev => [...prev, ...newFiles]);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []).filter(
            file => file.type === 'application/pdf'
        );

        console.log('Selected files:', selectedFiles.map(f => f.name));
        console.log('Current operation:', selectedOption);
        console.log('Current files:', files.map(f => f.name));

        if (selectedOption === 'merge-pdf') {
            if (files.length + selectedFiles.length > MAX_FILES) {
                showError(`You can only merge up to ${MAX_FILES} files at once.`);
                return;
            }
        } else if (files.length + selectedFiles.length > 1) {
            showError('You can only select one file for this operation.');
            return;
        }

        const newFiles = selectedFiles.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            file: file,
            preview: URL.createObjectURL(file)
        }));

        console.log('New files to be added:', newFiles.map(f => f.name));
        setFiles(prev => [...prev, ...newFiles]);

        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const _removeFile = (id: string) => {
        setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
    };

    const getDropText = () => {
        switch (selectedOption) {
            case "merge-pdf":
                return "Drag and drop your PDFs to merge them";
            case "split-pdf":
                return "Drag and drop your PDF to split it";
            case "compress-pdf":
                return "Drag and drop your PDF to compress it";
            default:
                return "Drag and drop your PDFs here";
        }
    };

    const mergePDFs = async (pdfFiles: FileWithPreview[]) => {
        try {
            setIsProcessing(true);
            const mergedPdf = await PDFDocument.create();

            for (const pdfFile of pdfFiles) {
                try {
                    const fileArrayBuffer = await pdfFile.file.arrayBuffer();
                    const pdf = await PDFDocument.load(fileArrayBuffer);
                    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                    copiedPages.forEach((page) => {
                        mergedPdf.addPage(page);
                    });
                } catch (error) {
                    showError(`Could not process ${pdfFile.name}. The file might be corrupted or password protected.`);
                    return;
                }
            }

            const mergedPdfFile = await mergedPdf.save();
            const blob = new Blob([mergedPdfFile], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            // Create a download link
            const link = document.createElement('a');
            link.href = url;
            link.download = 'merged.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Reset all state variables after successful merge
            setFiles([]);
            setSplitCount(2);
            setSplitPages([]);
            setPageCount(null);
            setError(null);

            console.log("PDFs merged successfully!");
        } catch (error) {
            console.error("Error merging PDFs:", error);
            showError("Could not complete the merge. Please ensure all files are valid PDFs and try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    const splitPDF = async (pdfFile: FileWithPreview, splitPoints: string[]) => {
        try {
            setIsProcessing(true);
            const fileArrayBuffer = await pdfFile.file.arrayBuffer();
            const pdf = await PDFDocument.load(fileArrayBuffer);
            const totalPages = pdf.getPageCount();

            // Validate split points
            const validSplitPoints = splitPoints
                .map(point => parseInt(point))
                .filter(point => !isNaN(point) && point > 0 && point < totalPages)
                .sort((a, b) => a - b);

            if (validSplitPoints.length === 0) {
                showError("Please enter valid page numbers to split. Each number must be between 1 and " + (totalPages - 1));
                return;
            }

            // Check for duplicate split points
            const uniqueSplitPoints = [...new Set(validSplitPoints)];
            if (uniqueSplitPoints.length !== validSplitPoints.length) {
                showError("Please remove duplicate page numbers from the split points.");
                return;
            }

            // Create PDFs for each split
            const splitPDFs: PDFDocument[] = [];
            let startPage = 0;

            // Add the last split point if not already included
            if (validSplitPoints[validSplitPoints.length - 1] !== totalPages - 1) {
                validSplitPoints.push(totalPages - 1);
            }

            try {
                for (const endPage of validSplitPoints) {
                    const newPdf = await PDFDocument.create();
                    const pages = await newPdf.copyPages(pdf, Array.from(
                        { length: endPage - startPage + 1 },
                        (_, i) => startPage + i
                    ));
                    pages.forEach(page => newPdf.addPage(page));
                    splitPDFs.push(newPdf);
                    startPage = endPage + 1;
                }
            } catch (error) {
                showError("Could not create the split PDFs. The file might be corrupted or password protected.");
                return;
            }

            // Save and download each split PDF
            for (let i = 0; i < splitPDFs.length; i++) {
                try {
                    const pdfBytes = await splitPDFs[i].save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);

                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `split_${i + 1}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                } catch (error) {
                    showError(`Could not save split_${i + 1}.pdf. Please try again with fewer splits.`);
                    return;
                }
            }

            console.log(`PDF split into ${splitPDFs.length} parts successfully!`);
        } catch (error) {
            console.error("Error splitting PDF:", error);
            if (error instanceof Error && error.message.includes("password")) {
                showError("This PDF is password protected. Please remove the password and try again.");
            } else {
                showError("Could not complete the split. Please try again with fewer splits or check if the file is corrupted.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const compressPDF = async (pdfFile: FileWithPreview) => {
        try {
            setIsProcessing(true);
            const fileArrayBuffer = await pdfFile.file.arrayBuffer();
            const pdf = await PDFDocument.load(fileArrayBuffer);

            // Compress the PDF
            const compressedPdfBytes = await pdf.save({
                useObjectStreams: true,
                addDefaultPage: false,
                objectsPerTick: 20
            });

            // Create and download the compressed file
            const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `compressed_${pdfFile.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Reset state after successful compression
            setFiles([]);
            setError(null);

            console.log("PDF compressed successfully!");
        } catch (error) {
            console.error("Error compressing PDF:", error);
            if (error instanceof Error && error.message.includes("password")) {
                showError("This PDF is password protected. Please remove the password and try again.");
            } else {
                showError("Could not complete the compression. Please try again.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleContinue = async () => {
        if (!selectedOption) {
            showError("Please select a PDF operation first");
            return;
        }

        const fileNames = files.map(file => file.name);

        switch (selectedOption) {
            case "merge-pdf":
                if (files.length < 2) {
                    showError("Please add at least 2 PDFs to merge");
                    return;
                }
                console.log("Merging PDFs:", fileNames);
                await mergePDFs(files);
                break;
            case "split-pdf":
                if (files.length > 1) {
                    showError("Split operation only accepts one PDF file");
                    return;
                }
                if (files.length === 0) {
                    showError("Please add a PDF file to split");
                    return;
                }
                if (splitPages.some(page => !page)) {
                    showError("Please fill in all split page numbers");
                    return;
                }
                console.log("Splitting PDF:", fileNames[0]);
                await splitPDF(files[0], splitPages);
                break;
            case "compress-pdf":
                if (files.length > 1) {
                    showError("Compress operation only accepts one PDF file");
                    return;
                }
                if (files.length === 0) {
                    showError("Please add a PDF file to compress");
                    return;
                }
                console.log("Compressing PDF:", fileNames[0]);
                await compressPDF(files[0]);
                break;
        }
    };

    return (
        <div className="flex items-center justify-center">
            <div className="bg-white px-8 pt-2 pb-8 rounded-lg shadow-lg w-[800px]">
                {!((selectedOption === "split-pdf" || selectedOption === "compress-pdf") && files.length > 0) ? (
                    <>
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${isDragging ? "border-red-400 bg-red-50" : "border-gray-300 hover:border-red-400"
                                }`}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={handleDrop}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                id="fileInput"
                                className="hidden"
                                multiple={selectedOption === "merge-pdf"}
                                accept=".pdf"
                                onChange={handleFileInput}
                            />
                            <label
                                htmlFor="fileInput"
                                className="cursor-pointer inline-block"
                            >
                                <div className="text-gray-600 mb-4">
                                    <p className="text-lg font-medium">{getDropText()}</p>
                                    <p className="text-sm mt-2">or</p>
                                    <button
                                        type="button"
                                        className="mt-4 px-6 py-2 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors duration-200"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Browse Files
                                    </button>
                                    <p className="text-sm mt-2 text-gray-500">
                                        {selectedOption === "merge-pdf" ? `Maximum ${MAX_FILES} files` : "Maximum 1 file"}
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* Added Files List */}
                        {files.length > 0 && (
                            <div className="mt-6">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Added Files:</h3>
                                <div className="space-y-2">
                                    {files.map((file, index) => (
                                        <div key={file.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <div className="flex items-center space-x-3">
                                                <IoIosDocument className="text-red-400 text-xl" />
                                                <span className="text-gray-700">{file.name}</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newFiles = files.filter((_, i) => i !== index);
                                                    setFiles(newFiles);
                                                }}
                                                className="text-red-400 hover:text-red-500 flex items-center space-x-1"
                                            >
                                                <IoClose className="text-xl" />
                                                <span>Remove</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 flex justify-center">
                                    <button
                                        onClick={handleContinue}
                                        disabled={isProcessing || (selectedOption === "merge-pdf" && files.length < 2)}
                                        className={`flex items-center space-x-2 px-6 py-3 bg-red-400 text-white rounded-lg transition-colors duration-200 font-medium ${isProcessing || (selectedOption === "merge-pdf" && files.length < 2)
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-red-500'
                                            }`}
                                    >
                                        <span>{isProcessing ? 'Processing...' : 'Continue'}</span>
                                        {!isProcessing && <IoIosArrowForward className="text-xl" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="p-8 text-center">
                        <div className="mb-6">
                            <p className="text-lg font-medium text-gray-700 mb-2">Selected File: {files[0].name}</p>
                            {pageCount !== null && selectedOption === "split-pdf" && (
                                <p className="text-gray-600 mb-4">Total Pages: {pageCount}</p>
                            )}
                            <button
                                onClick={() => setFiles([])}
                                className="text-red-400 hover:text-red-500 flex items-center justify-center space-x-1 mx-auto"
                            >
                                <IoClose className="text-xl" />
                                <span>Remove File</span>
                            </button>
                        </div>
                        {selectedOption === "split-pdf" && (
                            <div className="max-w-xs mx-auto">
                                <label className="block text-gray-700 font-medium mb-2">
                                    Number of PDFs
                                </label>
                                <input
                                    type="number"
                                    min="2"
                                    max={pageCount ? pageCount - 1 : undefined}
                                    value={splitCount}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value) || 2;
                                        const maxSplits = pageCount ? pageCount - 1 : 2;
                                        setSplitCount(Math.min(Math.max(2, value), maxSplits));
                                    }}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-center text-lg text-black"
                                />
                                <div className="mt-4">
                                    <label className="block text-gray-700 font-medium mb-2">
                                        Split After Pages:
                                    </label>
                                    <div className="overflow-x-auto pb-2 pt-1">
                                        <div className="flex space-x-2 min-w-min px-1">
                                            {splitPages.map((page, index) => (
                                                <input
                                                    key={index}
                                                    type="text"
                                                    value={page}
                                                    onChange={(e) => handleSplitPageChange(index, e.target.value)}
                                                    maxLength={3}
                                                    placeholder="..."
                                                    className="w-10 h-10 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-center text-base text-black flex-shrink-0"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2 text-center">
                                        Enter page numbers where you want to split
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={handleContinue}
                                disabled={isProcessing}
                                className={`flex items-center space-x-2 px-6 py-3 bg-red-400 text-white rounded-lg transition-colors duration-200 font-medium ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500'
                                    }`}
                            >
                                <span>{isProcessing ? 'Processing...' : 'Continue'}</span>
                                {!isProcessing && <IoIosArrowForward className="text-xl" />}
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm">{error}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FileAdder;


