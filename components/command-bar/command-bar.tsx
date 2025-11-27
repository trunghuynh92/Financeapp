'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCommandBar } from '@/contexts/CommandBarContext';
import { useEntity } from '@/contexts/EntityContext';
import {
  parseCommand,
  formatParsedCommand,
  type ParsedCommand,
  type CommandType,
} from '@/lib/command-parser';
import { cn } from '@/lib/utils';
import {
  Search,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Loader2,
  X,
  FileText,
  Wallet,
  LayoutDashboard,
  PiggyBank,
  BarChart3,
  Settings,
  Building2,
  Calendar,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
} from 'lucide-react';

// Transaction type from API
interface Transaction {
  id: string;
  transaction_date: string;
  description: string | null;
  amount: number;
  transaction_type: string;
  account?: { name: string } | null;
  category?: { name: string } | null;
}

// Result item types
type ResultType = 'action' | 'transaction' | 'navigation' | 'account';

interface ResultItem {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  meta?: string;
  action: () => void;
  data?: Transaction;
}

// Icon mapping for transaction types
const transactionTypeIcons: Record<string, React.ReactNode> = {
  TRF_OUT: <ArrowUpRight className="h-4 w-4 text-orange-500" />,
  TRF_IN: <ArrowDownLeft className="h-4 w-4 text-green-500" />,
  EXP: <TrendingDown className="h-4 w-4 text-red-500" />,
  INC: <TrendingUp className="h-4 w-4 text-green-500" />,
  CC_CHARGE: <CreditCard className="h-4 w-4 text-purple-500" />,
  CC_PAY: <CreditCard className="h-4 w-4 text-blue-500" />,
  DEBT_TAKE: <DollarSign className="h-4 w-4 text-yellow-500" />,
  DEBT_PAY: <DollarSign className="h-4 w-4 text-teal-500" />,
  LOAN_DISBURSE: <ArrowUpRight className="h-4 w-4 text-red-500" />,
  LOAN_COLLECT: <ArrowDownLeft className="h-4 w-4 text-green-500" />,
};

// Navigation items
const navigationItems = [
  { id: 'nav-dashboard', label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'nav-accounts', label: 'Accounts', path: '/dashboard/accounts', icon: <Wallet className="h-4 w-4" /> },
  { id: 'nav-transactions', label: 'Transactions', path: '/dashboard/main-transactions', icon: <Receipt className="h-4 w-4" /> },
  { id: 'nav-budgets', label: 'Budgets', path: '/dashboard/budgets', icon: <PiggyBank className="h-4 w-4" /> },
  { id: 'nav-cashflow', label: 'Cash Flow', path: '/dashboard/cash-flow', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'nav-reports', label: 'Reports', path: '/dashboard/reports', icon: <FileText className="h-4 w-4" /> },
  { id: 'nav-entities', label: 'Entities', path: '/dashboard/entities', icon: <Building2 className="h-4 w-4" /> },
  { id: 'nav-contracts', label: 'Contracts', path: '/dashboard/contracts', icon: <Calendar className="h-4 w-4" /> },
  { id: 'nav-settings', label: 'Settings', path: '/dashboard/settings', icon: <Settings className="h-4 w-4" /> },
];

// Quick action definitions
const quickActionDefs = [
  { id: 'action-trf-out', label: 'New Transfer Out', type: 'TRF_OUT', icon: <ArrowUpRight className="h-4 w-4 text-orange-500" /> },
  { id: 'action-trf-in', label: 'New Transfer In', type: 'TRF_IN', icon: <ArrowDownLeft className="h-4 w-4 text-green-500" /> },
  { id: 'action-expense', label: 'New Expense', type: 'EXP', icon: <TrendingDown className="h-4 w-4 text-red-500" /> },
  { id: 'action-income', label: 'New Income', type: 'INC', icon: <TrendingUp className="h-4 w-4 text-green-500" /> },
  { id: 'action-cc', label: 'New CC Charge', type: 'CC_CHARGE', icon: <CreditCard className="h-4 w-4 text-purple-500" /> },
];

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + ' ₫';
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CommandBar() {
  const { isOpen, closeCommandBar } = useCommandBar();
  const { currentEntity } = useEntity();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<'top' | 'transactions' | 'actions' | 'navigation'>('top');

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setParsedCommand(null);
      setTransactions([]);
      setSelectedIndex(0);
      setActiveSection('top');
    }
  }, [isOpen]);

  // Parse query and search transactions
  useEffect(() => {
    if (!currentEntity?.id) return;

    const searchTimeout = setTimeout(async () => {
      if (query.trim().length > 0) {
        const parsed = parseCommand(query);
        setParsedCommand(parsed);

        // Search transactions - always use raw query for text search
        // Don't filter by parsed amount/date as that's too restrictive for searching
        setIsSearching(true);
        try {
          const params = new URLSearchParams({
            entity_id: currentEntity.id,
            limit: '10',
            search: query.trim(), // Always search by full query text
          });

          const response = await fetch(`/api/transactions/search?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            setTransactions(data.transactions || []);
          }
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setParsedCommand(null);
        setTransactions([]);
      }
    }, 300); // Debounce

    return () => clearTimeout(searchTimeout);
  }, [query, currentEntity?.id]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeCommandBar();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeCommandBar]);

  // Build results list
  const results = useMemo((): ResultItem[] => {
    const items: ResultItem[] = [];

    // If we have a parsed command with amount/date, show "Create" action as top hit
    if (parsedCommand && parsedCommand.type !== 'unknown' && parsedCommand.type !== 'search' && parsedCommand.type !== 'navigate') {
      const typeLabels: Record<string, string> = {
        transfer_out: 'Transfer Out',
        transfer_in: 'Transfer In',
        expense: 'Expense',
        income: 'Income',
        cc_charge: 'CC Charge',
        cc_pay: 'CC Payment',
        debt_take: 'Borrow',
        debt_pay: 'Debt Payment',
      };

      items.push({
        id: 'create-from-command',
        type: 'action',
        title: `Create ${typeLabels[parsedCommand.type] || parsedCommand.type}`,
        subtitle: formatParsedCommand(parsedCommand),
        icon: <Plus className="h-4 w-4 text-primary" />,
        meta: 'Top Hit',
        action: () => {
          const params = new URLSearchParams();
          params.set('action', 'new');
          params.set('type', parsedCommand.type.toUpperCase());
          if (parsedCommand.amount) params.set('amount', parsedCommand.amount.toString());
          if (parsedCommand.date) params.set('date', parsedCommand.date.toISOString().split('T')[0]);
          if (parsedCommand.description) params.set('description', parsedCommand.description);
          router.push(`/dashboard/main-transactions?${params.toString()}`);
          closeCommandBar();
        },
      });
    }

    // Add matching transactions
    transactions.forEach((tx) => {
      items.push({
        id: tx.id,
        type: 'transaction',
        title: tx.description || `${tx.transaction_type} Transaction`,
        subtitle: tx.account?.name || 'Unknown Account',
        icon: transactionTypeIcons[tx.transaction_type] || <Receipt className="h-4 w-4" />,
        meta: `${formatDate(tx.transaction_date)} • ${formatCurrency(tx.amount)}`,
        action: () => {
          router.push(`/dashboard/main-transactions?highlight=${tx.id}`);
          closeCommandBar();
        },
        data: tx,
      });
    });

    // Add quick actions if query is short or matches
    if (query.length < 10) {
      const lowerQuery = query.toLowerCase();
      quickActionDefs.forEach((action) => {
        if (!query || action.label.toLowerCase().includes(lowerQuery) || action.type.toLowerCase().includes(lowerQuery)) {
          items.push({
            id: action.id,
            type: 'action',
            title: action.label,
            subtitle: 'Create new transaction',
            icon: action.icon,
            action: () => {
              router.push(`/dashboard/main-transactions?action=new&type=${action.type}`);
              closeCommandBar();
            },
          });
        }
      });
    }

    // Add matching navigation items
    const lowerQuery = query.toLowerCase();
    navigationItems.forEach((nav) => {
      if (!query || nav.label.toLowerCase().includes(lowerQuery)) {
        items.push({
          id: nav.id,
          type: 'navigation',
          title: `Go to ${nav.label}`,
          subtitle: nav.path,
          icon: nav.icon,
          action: () => {
            router.push(nav.path);
            closeCommandBar();
          },
        });
      }
    });

    return items;
  }, [parsedCommand, transactions, query, router, closeCommandBar]);

  // Categorize results
  const categorizedResults = useMemo(() => {
    const topHits = results.filter((r) => r.meta === 'Top Hit');
    const txResults = results.filter((r) => r.type === 'transaction');
    const actionResults = results.filter((r) => r.type === 'action' && r.meta !== 'Top Hit');
    const navResults = results.filter((r) => r.type === 'navigation');

    return { topHits, transactions: txResults, actions: actionResults, navigation: navResults };
  }, [results]);

  // Flatten for keyboard navigation
  const flatResults = useMemo(() => {
    return [
      ...categorizedResults.topHits,
      ...categorizedResults.transactions,
      ...categorizedResults.actions,
      ...categorizedResults.navigation,
    ];
  }, [categorizedResults]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (flatResults[selectedIndex]) {
        flatResults[selectedIndex].action();
      }
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const hasResults = flatResults.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Command Bar Container */}
      <div
        ref={containerRef}
        className={cn(
          'relative w-full max-w-2xl mx-4',
          'animate-in slide-in-from-top-4 fade-in duration-200'
        )}
      >
        {/* Glassmorphism Card */}
        <div
          className={cn(
            'rounded-2xl overflow-hidden',
            'bg-white/90 dark:bg-gray-900/90',
            'backdrop-blur-xl backdrop-saturate-150',
            'border border-white/30 dark:border-gray-700/50',
            'shadow-2xl shadow-black/25'
          )}
        >
          {/* Input Area */}
          <div className="relative flex items-center px-4 py-3 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center justify-center w-8 h-8 mr-3">
              {isSearching ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Search className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search transactions, create new, or navigate..."
              className={cn(
                'flex-1 bg-transparent border-none outline-none',
                'text-lg placeholder:text-muted-foreground/50',
                'text-foreground'
              )}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />

            <button
              onClick={closeCommandBar}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Results Area */}
          <div className="max-h-[60vh] overflow-y-auto" ref={resultsRef}>
            <div className="py-2">
              {/* No query - show quick actions */}
              {!query && (
                <>
                  <div className="px-4 py-1.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Quick Actions
                    </span>
                  </div>
                  {quickActionDefs.map((action, index) => (
                    <button
                      key={action.id}
                      data-index={index}
                      onClick={() => {
                        router.push(`/dashboard/main-transactions?action=new&type=${action.type}`);
                        closeCommandBar();
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        selectedIndex === index
                          ? 'bg-primary/10 dark:bg-primary/20'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      )}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10">
                        {action.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{action.label}</div>
                        <div className="text-xs text-muted-foreground">Create new transaction</div>
                      </div>
                    </button>
                  ))}

                  <div className="px-4 py-1.5 mt-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Navigation
                    </span>
                  </div>
                  {navigationItems.slice(0, 5).map((nav, idx) => {
                    const index = quickActionDefs.length + idx;
                    return (
                      <button
                        key={nav.id}
                        data-index={index}
                        onClick={() => {
                          router.push(nav.path);
                          closeCommandBar();
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                          selectedIndex === index
                            ? 'bg-primary/10 dark:bg-primary/20'
                            : 'hover:bg-black/5 dark:hover:bg-white/5'
                        )}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10">
                          {nav.icon}
                        </div>
                        <span className="text-sm">{nav.label}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {/* With query - show results */}
              {query && (
                <>
                  {/* Top Hits */}
                  {categorizedResults.topHits.length > 0 && (
                    <>
                      <div className="px-4 py-1.5">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Top Hit
                        </span>
                      </div>
                      {categorizedResults.topHits.map((result, idx) => {
                        const globalIndex = idx;
                        return (
                          <button
                            key={result.id}
                            data-index={globalIndex}
                            onClick={result.action}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                              selectedIndex === globalIndex
                                ? 'bg-primary/10 dark:bg-primary/20'
                                : 'hover:bg-black/5 dark:hover:bg-white/5'
                            )}
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20">
                              {result.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{result.title}</div>
                              {result.subtitle && (
                                <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
                              )}
                            </div>
                            <kbd className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 font-mono text-xs">
                              ↵
                            </kbd>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Transactions */}
                  {categorizedResults.transactions.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 mt-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Transactions ({categorizedResults.transactions.length})
                        </span>
                      </div>
                      {categorizedResults.transactions.map((result, idx) => {
                        const globalIndex = categorizedResults.topHits.length + idx;
                        return (
                          <button
                            key={result.id}
                            data-index={globalIndex}
                            onClick={result.action}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              selectedIndex === globalIndex
                                ? 'bg-primary/10 dark:bg-primary/20'
                                : 'hover:bg-black/5 dark:hover:bg-white/5'
                            )}
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10">
                              {result.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{result.title}</div>
                              <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                            </div>
                            <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                              {result.meta}
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Actions */}
                  {categorizedResults.actions.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 mt-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Actions
                        </span>
                      </div>
                      {categorizedResults.actions.map((result, idx) => {
                        const globalIndex = categorizedResults.topHits.length + categorizedResults.transactions.length + idx;
                        return (
                          <button
                            key={result.id}
                            data-index={globalIndex}
                            onClick={result.action}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                              selectedIndex === globalIndex
                                ? 'bg-primary/10 dark:bg-primary/20'
                                : 'hover:bg-black/5 dark:hover:bg-white/5'
                            )}
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10">
                              {result.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">{result.title}</div>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* Navigation */}
                  {categorizedResults.navigation.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 mt-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Navigation
                        </span>
                      </div>
                      {categorizedResults.navigation.slice(0, 5).map((result, idx) => {
                        const globalIndex =
                          categorizedResults.topHits.length +
                          categorizedResults.transactions.length +
                          categorizedResults.actions.length +
                          idx;
                        return (
                          <button
                            key={result.id}
                            data-index={globalIndex}
                            onClick={result.action}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                              selectedIndex === globalIndex
                                ? 'bg-primary/10 dark:bg-primary/20'
                                : 'hover:bg-black/5 dark:hover:bg-white/5'
                            )}
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10">
                              {result.icon}
                            </div>
                            <span className="text-sm">{result.title}</span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {/* No results */}
                  {!isSearching && flatResults.length === 0 && query.length > 2 && (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No results found for "{query}"</p>
                      <p className="text-xs mt-1">Try a different search term</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-muted-foreground bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px]">↑</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px]">↓</kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px]">↵</kbd>
                <span>select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px]">esc</kbd>
                <span>close</span>
              </span>
            </div>
            <div className="flex items-center gap-1 opacity-60">
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px]">⇧</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px]">S</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
