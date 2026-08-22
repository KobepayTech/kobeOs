import ProductionCreator from './ProductionCreator';

// Keep the public API hooks available to any existing callers while the
// visible Creator module is now exclusively the production workspace.
export * from './useCreatorApi';

export default ProductionCreator;
