import { DataHandlerContext, Log } from '@subsquid/evm-processor';
import { Store } from '@subsquid/typeorm-store';
import { events } from '../abi/CartesiDAppFactory';
import { LogRecord } from '../abi/abi.support';
import { EventConfig, NetworkConfig, eventConfigs } from '../configs';
import { DApp, DAppFactory } from '../model';
import Handler from './Handler';

export default class ApplicationCreated implements Handler {
    private readonly eventConfig: EventConfig;

    constructor(
        private readonly ctx: DataHandlerContext<Store>,
        private readonly config: NetworkConfig,
        private factoryStorage: Map<string, DAppFactory>,
        private dappsStorage: Map<String, DApp>,
    ) {
        this.eventConfig = eventConfigs;
    }

    private decodeFactory(evmLog: LogRecord) {
        return events.ApplicationCreated.decode(evmLog);
    }

    async handle(e: Log) {
        if (
            e.address === this.config.cartesiDAppFactory.address &&
            e.topics[0] ===
                this.eventConfig.cartesiDAppFactory.applicationCreated
        ) {
            const ctx = this.ctx;
            const timestamp = BigInt(e.block.timestamp);

            ctx.log.info(`Indexing factory ApplicationCreated event`);
            ctx.log.info(
                `e.address: ${e.address} - factory address: ${this.config.cartesiDAppFactory.address}`,
            );
            const { application, dappOwner } = this.decodeFactory(e);

            const dappFactory = new DAppFactory({ id: e.address });

            this.factoryStorage.set(e.address, dappFactory);

            const dappId = application.toLowerCase();

            let dapp =
                this.dappsStorage.get(dappId) ??
                (await ctx.store.get(DApp, dappId));

            if (dapp) {
                ctx.log.info(
                    `Dapp:${dappId} created by event found. updating owner/factory/status`,
                );
                dapp.factory = dappFactory;
                dapp.owner = dappOwner.toLowerCase();
            } else {
                ctx.log.info(
                    `Dapp:${dappId} will be created and added to the Map`,
                );
                dapp = new DApp({
                    id: dappId,
                    activityTimestamp: timestamp,
                    deploymentTimestamp: timestamp,
                    factory: dappFactory,
                    inputCount: 0,
                    owner: dappOwner.toLowerCase(),
                });
            }

            this.dappsStorage.set(dappId, dapp);
        }

        return true;
    }
}