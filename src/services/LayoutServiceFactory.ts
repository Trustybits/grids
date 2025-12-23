import { type LayoutService } from './LayoutService';
import { MockLayoutService } from './MockLayoutService';
import { FirestoreLayoutService } from './FirestoreLayoutService';

const useMockData = false;

export const getLayoutService = (): LayoutService => {
  if (useMockData) {
    // return new MockLayoutService();
  } 

  return new FirestoreLayoutService(); // Uncomment for Firestore
  throw new Error('Firestore implementation not yet available');
};
