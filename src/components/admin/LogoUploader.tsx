import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { FileImage, Upload, X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface LogoUploaderProps {
  onUploadComplete: (url: string) => void;
  currentLogo?: string | null;
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({ onUploadComplete, currentLogo }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(currentLogo || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 2MB)
      if (selectedFile.size > 2 * 1024 * 1024) {
        setError('Image must be less than 2MB');
        return;
      }
      
      setFile(selectedFile);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('rfp-logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('rfp-logos')
        .getPublicUrl(filePath);

      onUploadComplete(publicUrl);
    } catch (error) {
      console.error('Error uploading logo:', error);
      setError('Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {preview ? (
        <div className="relative">
          <img 
            src={preview} 
            alt="Logo preview" 
            className="max-h-32 rounded-lg border border-gray-200"
          />
          <button
            onClick={handleRemove}
            className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md border border-gray-200 hover:bg-gray-50"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      ) : (
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
          />
          <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-gray-500 mt-1">
            PNG, JPG up to 2MB
          </p>
        </div>
      )}

      {file && !uploading && (
        <Button
          onClick={handleUpload}
          leftIcon={<Upload className="h-4 w-4" />}
          fullWidth
        >
          Upload Logo
        </Button>
      )}

      {uploading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
        </div>
      )}
    </div>
  );
};