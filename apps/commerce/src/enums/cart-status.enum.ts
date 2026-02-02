export enum CartStatus {
    ACTIVE = 'ACTIVE',        // user adding items
    ABANDONED = 'ABANDONED',  // old cart without activity
    CHECKOUT = 'CHECKOUT'   // turned into checkout
}