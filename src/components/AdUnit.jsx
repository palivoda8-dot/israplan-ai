import React from 'react';
import { DollarSign } from 'lucide-react';

const AdUnit = ({ position, slotId }) => {
    return (
        <div className="w-full my-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center text-slate-400 min-h-[120px] animate-fade-in relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-slate-200 text-xs px-2 py-1 rounded text-slate-500">פרסומת</div>
            <DollarSign className="mb-2 opacity-50" size={24} />
            <span className="font-bold text-sm text-slate-500">שטח פרסום ({position})</span>
            <span className="text-xs text-center mt-1 max-w-md">
                כאן יופיעו מודעות Google AdSense. (Slot ID: {slotId || 'טרם הוגדר'})
            </span>
        </div>
    );
};

export default AdUnit;