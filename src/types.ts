export type Category = 
  | 'Food' 
  | 'Rent' 
  | 'Travel' 
  | 'Bills' 
  | 'Shopping' 
  | 'Entertainment' 
  | 'Health' 
  | 'Income' 
  | 'Other';

export type PaymentMethod = 'Cash' | 'UPI' | 'Card';

export interface Transaction {
  id: string;
  amount: number;
  category: Category;
  description: string;
  date: string;
  type: 'income' | 'expense';
  paymentMethod: PaymentMethod;
  isRecurring?: boolean;
}

export interface Budget {
  category: Category;
  limit: number;
  spent: number;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'tip' | 'positive';
  date: string;
}
