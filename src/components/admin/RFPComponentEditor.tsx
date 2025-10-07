import React, { useState } from 'react';
import { RFPComponent } from '../../types';
import { Lock, Save, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface RFPComponentEditorProps {
  component: RFPComponent;
  onChange: (component: RFPComponent) => void;
  isSaving?: boolean;
}

export const RFPComponentEditor: React.FC<RFPComponentEditorProps> = ({ 
  component, 
  onChange,
  isSaving = false
}) => {
  const [title, setTitle] = useState(component.title);
  const [content, setContent] = useState(component.content);
  const [requiresApproval, setRequiresApproval] = useState(component.requires_approval);
  
  const handleSave = () => {
    onChange({
      ...component,
      title,
      content,
      requires_nda: false, // Always set to false since feature is removed
      requires_approval: requiresApproval,
      updated_at: new Date().toISOString()
    });
  };
  
  return (
    <div className="space-y-4">
      <Input
        label="Section Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Enter a title for this section"
      />
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <div className="border border-gray-300 rounded-md shadow-sm overflow-hidden">
          <div className="bg-white p-2 border-b border-gray-200 flex items-center space-x-2">
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-100"
              onClick={() => setContent(content + '<h2>Heading</h2>')}
            >
              H2
            </button>
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-100"
              onClick={() => setContent(content + '<h3>Subheading</h3>')}
            >
              H3
            </button>
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-100"
              onClick={() => setContent(content + '<p>Paragraph text</p>')}
            >
              P
            </button>
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-100"
              onClick={() => setContent(content + '<ul><li>List item</li></ul>')}
            >
              UL
            </button>
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-100"
              onClick={() => setContent(content + '<ol><li>List item</li></ol>')}
            >
              OL
            </button>
            <button
              type="button"
              className="p-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-100"
              onClick={() => setContent(content + '<table><tr><td>Table cell</td></tr></table>')}
            >
              Table
            </button>
          </div>
          <textarea
            rows={10}
            className="block w-full border-0 focus:ring-0"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter section content here (HTML supported)"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          HTML formatting is supported. Basic editor provided for convenience.
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id={`requires-approval-${component.id}`}
            checked={requiresApproval}
            onChange={(e) => setRequiresApproval(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor={`requires-approval-${component.id}`} className="ml-2 block text-sm text-gray-900">
            Requires Access Approval
          </label>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button 
          variant="outline" 
          size="sm" 
          type="button" 
          onClick={handleSave}
          leftIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Section'}
        </Button>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Preview</h3>
        <div className="bg-white border border-gray-200 rounded-md p-4">
          {content ? (
            <div 
              className="prose prose-sm max-w-none" 
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <p className="text-gray-500 italic">No content has been added to this section yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};