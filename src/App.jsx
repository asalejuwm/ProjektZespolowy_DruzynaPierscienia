import React, { useState } from "react";
import { motion } from "framer-motion";

export default function App() {
  const initialColumns = {
    todo: { name: "To Do", wip: 5, tasks: ["Zadanie 1", "Zadanie 2", "Zadanie 3", "Zadanie 4", "Zadanie 5"] },
    inprogress: { name: "In Progress", wip: 3, tasks: [] },
    test: { name: "Test", wip: 3, tasks: [] },
    review: { name: "Review", wip: 3, tasks: [] },
    done: { name: "Done", wip: 10, tasks: [] },
  };

  const [columns, setColumns] = useState(initialColumns);
  const [dragged, setDragged] = useState(null);

  const handleDrop = (colKey) => {
    if (!dragged) return;
    const { fromCol, task } = dragged;
    
    const updated = { ...columns };
    // Usuwamy zadanie z poprzedniej kolumny
    updated[fromCol].tasks = updated[fromCol].tasks.filter((t) => t !== task);
    // Dodajemy do nowej (brak blokady WIP)
    updated[colKey].tasks = [...updated[colKey].tasks, task];
    
    setColumns(updated);
    setDragged(null);
  };

  const updateWip = (colKey, value) => {
    const updated = { ...columns };
    updated[colKey].wip = Number(value);
    setColumns(updated);
  };

  const resetBoard = () => {
    setColumns(initialColumns);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-800">Kanban Board</h1>
        <button 
          onClick={resetBoard}
          className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 font-medium transition-colors"
        >
          Resetuj tablicę (F5)
        </button>
      </div>
      
      <div className="flex flex-row space-x-6 overflow-x-auto pb-8 items-start">
        {Object.entries(columns).map(([key, col]) => {
          const isOverLimit = col.tasks.length > col.wip;

          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(key)}
              className={`flex-shrink-0 w-80 rounded-xl border-2 shadow-sm transition-all duration-300 ${
                isOverLimit 
                  ? "bg-red-50 border-red-500 ring-2 ring-red-200" 
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              {/* Nagłówek Kolumny */}
              <div className={`p-4 border-b-2 rounded-t-xl ${
                isOverLimit ? "bg-red-100 border-red-500" : "bg-white border-gray-200"
              }`}>
                <div className="flex justify-between items-center">
                  <h2 className={`text-lg font-bold uppercase tracking-wider ${
                    isOverLimit ? "text-red-700" : "text-gray-700"
                  }`}>
                    {col.name}
                  </h2>
                  <span className={`text-sm font-black px-2 py-1 rounded-full ${
                    isOverLimit ? "bg-red-600 text-white" : "bg-gray-200 text-gray-600"
                  }`}>
                    {col.tasks.length} / {col.wip}
                  </span>
                </div>
                
                <div className="mt-3 flex items-center text-xs">
                  <label className={`font-semibold mr-2 ${isOverLimit ? "text-red-700" : "text-gray-500"}`}>
                    LIMIT WIP:
                  </label>
                  <input
                    type="number"
                    value={col.wip}
                    min={1}
                    onChange={(e) => updateWip(key, e.target.value)}
                    className="border rounded px-1 py-0.5 w-12 text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Obszar Zadań */}
              <div className="p-3 space-y-3 min-h-[500px]">
                {col.tasks.map((task) => (
                  <motion.div
                    key={task}
                    layoutId={task}
                    draggable
                    onDragStart={() => setDragged({ fromCol: key, task })}
                    className={`p-4 bg-white rounded-lg shadow-sm border-2 cursor-grab active:cursor-grabbing transition-colors ${
                      isOverLimit ? "border-red-200" : "border-transparent"
                    }`}
                    whileHover={{ 
                      scale: 1.02, 
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                      borderColor: isOverLimit ? "#ef4444" : "#3b82f6"
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <p className="text-gray-800 font-medium">{task}</p>
                  </motion.div>
                ))}

                {col.tasks.length === 0 && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg h-24 flex items-center justify-center text-gray-400 text-sm">
                    Przeciągnij tutaj
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}