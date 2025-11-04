"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value?: string // YYYY-MM-DD format
  onChange: (date: string) => void
  placeholder?: string
  label?: string
  max?: string // YYYY-MM-DD format for max date
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Click to select date",
  label,
  max,
  className
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const inputRef = useRef<HTMLInputElement>(null)

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  // Parse existing value when component mounts or value changes
  useEffect(() => {
    if (value) {
      const [year, month, day] = value.split('-').map(Number)
      if (year && month && day) {
        setSelectedYear(year)
        setSelectedMonth(month - 1)
        setSelectedDay(day)
      }
    }
  }, [value])

  const openCalendar = () => {
    if (value) {
      const [year, month, day] = value.split('-').map(Number)
      setSelectedYear(year)
      setSelectedMonth(month - 1)
      setSelectedDay(day)
    } else {
      const today = new Date()
      setSelectedYear(today.getFullYear())
      setSelectedMonth(today.getMonth())
      setSelectedDay(today.getDate())
    }
    setIsOpen(true)
  }

  const closeCalendar = () => {
    setIsOpen(false)
  }

  const confirmAndClose = () => {
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    onChange(dateStr)
    closeCalendar()
  }

  const selectDay = (day: number) => {
    setSelectedDay(day)
    // Auto-confirm on selection
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(dateStr)
    closeCalendar()
  }

  const previousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  const goToToday = () => {
    const today = new Date()
    setSelectedYear(today.getFullYear())
    setSelectedMonth(today.getMonth())
    setSelectedDay(today.getDate())
  }

  const renderCalendar = () => {
    const days = []
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1)
    let firstDay = firstDayOfMonth.getDay()
    // Convert Sunday (0) to 7, then subtract 1 to make Monday = 0
    firstDay = firstDay === 0 ? 6 : firstDay - 1

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const today = new Date()

    // Days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      days.push(
        <button
          key={`prev-${day}`}
          type="button"
          className="h-10 flex items-center justify-center text-base rounded-full cursor-pointer transition-all text-gray-300 hover:bg-gray-100"
          onClick={() => {
            previousMonth()
            selectDay(day)
          }}
        >
          {day}
        </button>
      )
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() && day === today.getDate()
      const isSelected = day === selectedDay

      days.push(
        <button
          key={`current-${day}`}
          type="button"
          className={cn(
            "h-10 flex items-center justify-center text-base rounded-full cursor-pointer transition-all",
            isSelected && "bg-blue-500 text-white font-semibold",
            !isSelected && isToday && "font-semibold",
            !isSelected && "hover:bg-gray-100"
          )}
          onClick={() => selectDay(day)}
        >
          {day}
        </button>
      )
    }

    // Days from next month - always fill to 42 cells (6 rows)
    const totalCells = days.length
    const remainingCells = 42 - totalCells
    for (let day = 1; day <= remainingCells; day++) {
      days.push(
        <button
          key={`next-${day}`}
          type="button"
          className="h-10 flex items-center justify-center text-base rounded-full cursor-pointer transition-all text-gray-300 hover:bg-gray-100"
          onClick={() => {
            nextMonth()
            selectDay(day)
          }}
        >
          {day}
        </button>
      )
    }

    return days
  }

  const formatDisplayValue = () => {
    if (!value) return placeholder
    const [year, month, day] = value.split('-').map(Number)
    return `${monthsFull[month - 1]} ${day}, ${year}`
  }

  // Generate year options (current year ± 100 years)
  const currentYear = new Date().getFullYear()
  const yearOptions = []
  for (let year = currentYear - 100; year <= currentYear + 100; year++) {
    yearOptions.push(year)
  }

  return (
    <div className={cn("relative", className)}>
      {label && (
        <label className="block mb-2 text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        type="text"
        value={formatDisplayValue()}
        placeholder={placeholder}
        readOnly
        onClick={openCalendar}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
      />

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 animate-in fade-in duration-200"
          onClick={confirmAndClose}
        >
          <div
            className="bg-white rounded-xl w-11/12 max-w-sm overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Date Display */}
            <div className="p-5 bg-white border-b border-gray-200">
              <span className="text-5xl font-bold text-blue-500 leading-none inline-block">
                {String(selectedDay).padStart(2, '0')}
              </span>
              <span className="text-2xl font-semibold text-black inline-block ml-2">
                /{String(selectedMonth + 1).padStart(2, '0')}/{selectedYear}
              </span>
            </div>

            {/* Calendar Header */}
            <div className="px-5 py-4 flex justify-between items-center bg-white">
              <div className="flex gap-2 items-center">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-2.5 py-1.5 text-base font-semibold border-none bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {months.map((month, index) => (
                    <option key={month} value={index}>{month}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-2.5 py-1.5 text-base font-semibold border-none bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {yearOptions.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={previousMonth}
                  className="w-8 h-8 border-none bg-gray-100 rounded-full cursor-pointer flex items-center justify-center transition-colors text-gray-600 hover:bg-gray-200"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="w-8 h-8 border-none bg-gray-600 rounded-full cursor-pointer flex items-center justify-center transition-colors text-white"
                >
                  ●
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-8 h-8 border-none bg-gray-100 rounded-full cursor-pointer flex items-center justify-center transition-colors text-gray-600 hover:bg-gray-200"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* Calendar Body */}
            <div className="px-4 pb-5 bg-white">
              {/* Weekdays */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 min-h-[240px]">
                {renderCalendar()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
