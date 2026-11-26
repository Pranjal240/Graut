# Machine learning playbook

For training, evaluating and shipping models.

## Before training

1. State the prediction, the moment it is made, the metric that matters and the number that counts as good.
2. Look at the data: size, types, missing values, duplicates, label balance, a few raw rows.
3. Build the dumbest baseline first (majority class, mean, last value, a linear model). Beat it or stop.

## Leakage, the usual reason results look great and fail later

- Split before fitting anything. Scalers, encoders, imputers and feature selection learn from the training split only (use a pipeline).
- Time data splits by time. Rows from one person, device or document stay in one split.
- Drop features that are only known after the outcome. A suspiciously high score is a bug until shown otherwise.
- Tune on validation or cross-validation. The test set is used once.

## Training

- Fix and record seeds, data version, code version, parameters and metrics.
- Overfit one small batch first: if the loss will not drop, the code is broken.
- Watch training and validation curves. A gap means overfitting; both bad means underfitting or bad features.
- Imbalanced data: precision, recall, F1 or PR curve, and a chosen threshold. Accuracy alone misleads.

## Done when

Report the baseline and your model on the same untouched test set, with the spread across folds or seeds. Show errors by important subgroup and a few wrong predictions. For shipping: the same preprocessing in training and serving, input checks, a saved model with its dependencies, and a way to notice drift and roll back.
