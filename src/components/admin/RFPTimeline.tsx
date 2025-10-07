import React from 'react';
import { Calendar, Plus, Trash2, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { getUSTimezones, getUserTimezone, toLocalInputString, formatDate } from '../../utils/dateUtils';

interface Milestone {
  id: string;
  title: string;
  date: string;
  description?: string;
  timezone?: string;
  has_time?: boolean;
}

interface RFPTimelineProps {
  milestones: Milestone[];
  onChange: (milestones: Milestone[]) => void;
}

export const RFPTimeline: React.FC<RFPTimelineProps> = ({ milestones, onChange }) => {
  const handleAddMilestone = () => {
    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      title: '',
      date: new Date().toISOString().split('T')[0] + 'T12:00:00.000Z',
      timezone: getUserTimezone(),
      has_time: false
    };
    onChange([...milestones, newMilestone]);
  };

  const handleRemoveMilestone = (id: string) => {
    onChange(milestones.filter(m => m.id !== id));
  };

  const handleMilestoneChange = (id: string, field: keyof Milestone, value: string) => {
    if (field === 'date') {
      // Find the milestone to check if it has time
      const milestone = milestones.find(m => m.id === id);
      if (milestone) {
        // If it's a date-only milestone, store as noon UTC to avoid timezone shifts
        const updatedValue = milestone.has_time ? 
          new Date(value).toISOString() : 
          `${value.split('T')[0]}T12:00:00.000Z`;
        
        onChange(
          milestones.map(m => 
            m.id === id ? { ...m, [field]: updatedValue } : m
          )
        );
        return;
      }
    }
    
    onChange(
      milestones.map(m => 
        m.id === id ? { ...m, [field]: value } : m
      )
    );
  };

  const handleMilestoneTypeChange = (id: string, hasTime: boolean) => {
    const milestone = milestones.find(m => m.id === id);
    if (!milestone) return;
    
    // Convert date format based on type
    let newDate = milestone.date;
    if (hasTime && milestone.date.includes('T12:00:00')) {
      // Converting from date-only to datetime, set to 9 AM in milestone timezone
      const dateOnly = milestone.date.split('T')[0];
      newDate = `${dateOnly}T09:00:00.000Z`;
    } else if (!hasTime) {
      // Converting from datetime to date-only, store as noon UTC
      const dateOnly = milestone.date.split('T')[0];
      newDate = `${dateOnly}T12:00:00.000Z`;
    }
    
    onChange(
      milestones.map(m => 
        m.id === id ? { ...m, has_time: hasTime, date: newDate } : m
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Clock className="h-5 w-5 text-gray-400 mr-2" />
          Timeline & Milestones
        </h3>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={handleAddMilestone}
        >
          Add Milestone
        </Button>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h4 className="text-sm font-medium text-gray-900 mb-1">No Milestones Set</h4>
          <p className="text-sm text-gray-500 mb-4">
            Add important dates and milestones for this RFP
          </p>
          <Button
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleAddMilestone}
          >
            Add First Milestone
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {milestones.map((milestone, index) => (
            <div 
              key={milestone.id}
              className="bg-white p-4 rounded-lg border border-gray-200 space-y-4"
            >
              <div className="flex justify-between items-start">
                <h4 className="font-medium text-gray-900">Milestone {index + 1}</h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  onClick={() => handleRemoveMilestone(milestone.id)}
                >
                  Remove
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={milestone.title}
                    onChange={(e) => handleMilestoneChange(milestone.id, 'title', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="e.g., Bidder Conference, Proposal Due Date"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`milestone-type-${milestone.id}`}
                        checked={!milestone.has_time}
                        onChange={() => handleMilestoneTypeChange(milestone.id, false)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Date Only</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`milestone-type-${milestone.id}`}
                        checked={milestone.has_time}
                        onChange={() => handleMilestoneTypeChange(milestone.id, true)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Date & Time</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <select
                    value={milestone.timezone || getUserTimezone()}
                    onChange={(e) => handleMilestoneChange(milestone.id, 'timezone', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    {getUSTimezones().map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {milestone.has_time ? 'Date & Time' : 'Date'}
                  </label>
                  <input
                    type={milestone.has_time ? 'datetime-local' : 'date'}
                    value={toLocalInputString(
                      milestone.date, 
                      milestone.timezone, 
                      !milestone.has_time
                    )}
                    onChange={(e) => handleMilestoneChange(milestone.id, 'date', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {milestone.timezone && formatDate(
                      milestone.date, 
                      milestone.has_time ? 'PPpp' : 'PP',
                      milestone.timezone
                    )}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={milestone.description || ''}
                    onChange={(e) => handleMilestoneChange(milestone.id, 'description', e.target.value)}
                    rows={2}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Optional description of this milestone"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};