'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useHelp } from '@/contexts/HelpContext';
import {
  helpNavigation,
  getHelpContent,
  getParentSection,
  type HelpNavItem,
} from '@/lib/help/help-content';
import {
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  BookOpen,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

// Navigation item component
function NavItem({
  item,
  currentSection,
  onNavigate,
  level = 0,
}: {
  item: HelpNavItem;
  currentSection: string;
  onNavigate: (id: string) => void;
  level?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(
    currentSection.startsWith(item.id)
  );
  const hasChildren = item.children && item.children.length > 0;
  const isActive = currentSection === item.id;
  const isParentActive = currentSection.startsWith(item.id + '/');

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          }
          // Navigate to first child if this is a parent section
          if (hasChildren && item.children) {
            onNavigate(item.children[0].id);
          }
        }}
        className={cn(
          'flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          (isActive || isParentActive) && 'bg-accent/50 font-medium',
          level > 0 && 'pl-6'
        )}
      >
        {hasChildren && (
          <span className="mr-1">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        )}
        <span>{item.title}</span>
      </button>

      {hasChildren && isExpanded && (
        <div className="ml-2 border-l border-border pl-2 mt-1 space-y-1">
          {item.children!.map((child) => (
            <button
              key={child.id}
              onClick={() => onNavigate(child.id)}
              className={cn(
                'flex items-center w-full px-3 py-1.5 text-sm rounded-md transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                currentSection === child.id && 'bg-accent font-medium'
              )}
            >
              {child.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Breadcrumb component
function Breadcrumb({
  currentSection,
  onNavigate,
}: {
  currentSection: string;
  onNavigate: (id: string) => void;
}) {
  const parent = getParentSection(currentSection);
  const parentItem = parent
    ? helpNavigation.find((item) => item.id === parent)
    : null;
  const content = getHelpContent(currentSection);

  return (
    <div className="flex items-center text-sm text-muted-foreground mb-4">
      <button
        onClick={() => onNavigate('getting-started/welcome')}
        className="hover:text-foreground"
      >
        <Home className="h-4 w-4" />
      </button>
      {parentItem && (
        <>
          <ChevronRight className="h-4 w-4 mx-1" />
          <button
            onClick={() => {
              if (parentItem.children?.[0]) {
                onNavigate(parentItem.children[0].id);
              }
            }}
            className="hover:text-foreground"
          >
            {parentItem.title}
          </button>
        </>
      )}
      {content && (
        <>
          <ChevronRight className="h-4 w-4 mx-1" />
          <span className="text-foreground">{content.title}</span>
        </>
      )}
    </div>
  );
}

export function HelpPanel() {
  const { isOpen, currentSection, closeHelp, navigateTo } = useHelp();
  const [showNav, setShowNav] = useState(true);
  const content = getHelpContent(currentSection);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeHelp()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col"
      >
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <SheetTitle>Help & Documentation</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNav(!showNav)}
              className="text-xs"
            >
              {showNav ? 'Hide Menu' : 'Show Menu'}
            </Button>
          </div>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Navigation sidebar */}
          {showNav && (
            <div className="w-56 border-r bg-muted/30 flex-shrink-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-1">
                  {helpNavigation.map((item) => (
                    <NavItem
                      key={item.id}
                      item={item}
                      currentSection={currentSection}
                      onNavigate={navigateTo}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6">
                <Breadcrumb
                  currentSection={currentSection}
                  onNavigate={navigateTo}
                />

                {content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        h2: ({ children }) => (
                          <h2 className="text-xl font-semibold mt-6 mb-3 first:mt-0">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-lg font-medium mt-4 mb-2">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-sm text-muted-foreground mb-3">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-5 mb-3 text-sm text-muted-foreground space-y-1">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-5 mb-3 text-sm text-muted-foreground space-y-1">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => <li>{children}</li>,
                        strong: ({ children }) => (
                          <strong className="font-semibold text-foreground">
                            {children}
                          </strong>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4">
                            <table className="min-w-full border border-border rounded-lg text-sm">
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-muted">{children}</thead>
                        ),
                        th: ({ children }) => (
                          <th className="px-3 py-2 text-left font-medium border-b border-border">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-3 py-2 border-b border-border">
                            {children}
                          </td>
                        ),
                        code: ({ children }) => (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-sm">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {content.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Content not found</p>
                    <Button
                      variant="link"
                      onClick={() => navigateTo('getting-started/welcome')}
                    >
                      Go to Welcome
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
