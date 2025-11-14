import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MatchSuggestion } from '@/lib/api/accounting';
import { CheckCircle2, TrendingUp, Calendar, Hash } from 'lucide-react';

interface MatchSuggestionCardProps {
  suggestion: MatchSuggestion;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  allocationAmount?: number;
  onAmountChange: (amount: number) => void;
}

export function MatchSuggestionCard({
  suggestion,
  isSelected,
  onSelect,
  allocationAmount,
  onAmountChange,
}: MatchSuggestionCardProps) {
  const {
    journal_id,
    journal_reference,
    journal_description,
    entity_name,
    outstanding_amount,
    journal_date,
    match_score,
    confidence,
    exact_amount_match,
    entity_name_match,
    reference_match,
    date_proximity_match,
  } = suggestion;

  // Determine confidence level color and text
  const getConfidenceBadge = () => {
    if (confidence === 'high') {
      return <Badge className="bg-green-500 hover:bg-green-600">High Confidence</Badge>;
    } else if (confidence === 'medium') {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Medium Confidence</Badge>;
    } else {
      return <Badge className="bg-orange-500 hover:bg-orange-600">Low Confidence</Badge>;
    }
  };

  // Determine score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-orange-600';
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card
      className={`p-4 cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      onClick={() => onSelect(!isSelected)}
    >
      <div className="space-y-3">
        {/* Header: Checkbox, Reference, Score, Confidence */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="font-semibold text-base">
                {journal_reference || `Journal #${journal_id}`}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {journal_description || 'No description'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <div className={`text-2xl font-bold ${getScoreColor(match_score)}`}>
              {match_score}
            </div>
            {getConfidenceBadge()}
          </div>
        </div>

        {/* Entity and Amount */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Entity</Label>
            <div className="font-medium mt-1">{entity_name}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Outstanding Amount</Label>
            <div className="font-medium mt-1">{formatCurrency(outstanding_amount)}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Journal Date</Label>
            <div className="font-medium mt-1">{formatDate(journal_date)}</div>
          </div>
        </div>

        {/* Match Factors */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {exact_amount_match && (
            <Badge variant="outline" className="gap-1 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
              <TrendingUp className="w-3 h-3" />
              Exact Amount
            </Badge>
          )}
          {entity_name_match && (
            <Badge variant="outline" className="gap-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              <CheckCircle2 className="w-3 h-3" />
              Entity Match
            </Badge>
          )}
          {reference_match && (
            <Badge variant="outline" className="gap-1 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              <Hash className="w-3 h-3" />
              Reference Match
            </Badge>
          )}
          {date_proximity_match && (
            <Badge variant="outline" className="gap-1 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
              <Calendar className="w-3 h-3" />
              Date Proximity
            </Badge>
          )}
        </div>

        {/* Allocation Amount Input (only shown when selected) */}
        {isSelected && (
          <div className="pt-3 border-t" onClick={(e) => e.stopPropagation()}>
            <Label htmlFor={`amount-${journal_id}`} className="text-sm">
              Allocation Amount
            </Label>
            <Input
              id={`amount-${journal_id}`}
              type="number"
              step="0.01"
              min="0"
              max={outstanding_amount}
              value={allocationAmount ?? outstanding_amount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
              className="mt-2"
              placeholder="Enter allocation amount"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum: {formatCurrency(outstanding_amount)}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
