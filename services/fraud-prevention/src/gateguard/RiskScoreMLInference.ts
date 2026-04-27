// services/fraud-prevention/src/gateguard/RiskScoreMLInference.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RiskFeatures, RiskPrediction } from '../interfaces/shared';

@Injectable()
export class RiskScoreMLInference implements OnModuleInit {
  private readonly logger = new Logger(RiskScoreMLInference.name);
  private session: unknown = null;

  async onModuleInit(): Promise<void> {
    const modelPath = process.env.ML_MODEL_PATH || './models/gateguard_risk_v1.onnx';
    try {
      // Dynamic import avoids hard dep on onnxruntime-node at startup
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const ort = require('onnxruntime-node') as { InferenceSession: { create(p: string): Promise<unknown> } };
      this.session = await ort.InferenceSession.create(modelPath);
      this.logger.log('ONNX model loaded', { modelPath });
    } catch {
      this.logger.warn('ONNX model not available — rule-based fallback active', { modelPath });
    }
  }

  async predict(features: RiskFeatures): Promise<RiskPrediction> {
    if (this.session) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const ort = require('onnxruntime-node') as {
          Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
        };
        const featureValues = Object.values(features) as number[];
        const inputTensor = new ort.Tensor('float32', new Float32Array(featureValues), [1, featureValues.length]);
        const inferenceSession = this.session as { run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>> };
        const results = await inferenceSession.run({ input: inputTensor });
        const score = results['output'].data[0] * 100;
        return {
          riskScore: Math.round(score),
          tier: this.getTier(score),
          confidence: 0.94,
          modelVersion: 'onnx-v1.0',
        };
      } catch (err) {
        this.logger.warn('ONNX inference failed — falling back to rules', { err });
      }
    }

    return this.ruleBasedPredict(features);
  }

  private ruleBasedPredict(features: RiskFeatures): RiskPrediction {
    const score =
      features.friendlyFraudScore * 0.3 +
      features.chargebackCount30d * 10 +
      features.extensionAbuseCount * 8 +
      features.paymentDeclineRate * 40 +
      features.rapidPurchaseVelocity * 5;

    const capped = Math.min(score, 100);
    return {
      riskScore: Math.round(capped),
      tier: this.getTier(capped),
      confidence: 0.85,
      modelVersion: 'rule-fallback-v1.0',
    };
  }

  private getTier(score: number): RiskPrediction['tier'] {
    if (score >= 85) return 'RED';
    if (score >= 60) return 'ORANGE';
    if (score >= 30) return 'YELLOW';
    return 'GREEN';
  }
}
