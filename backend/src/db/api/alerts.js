
const db = require('../models');
const crypto = require('crypto');
const Utils = require('../utils');

const Sequelize = db.Sequelize;
const Op = Sequelize.Op;

module.exports = class AlertsDBApi {

    static async create(data, options) {
        const currentUser = (options && options.currentUser) || { id: null };
        const transaction = (options && options.transaction) || undefined;

        const alerts = await db.alerts.create(
            {
                id: data.id || undefined,

        message: data.message
        ||
        null
            ,

        triggered_at: data.triggered_at
        ||
        null
            ,

            importHash: data.importHash || null,
            createdById: currentUser.id,
            updatedById: currentUser.id,
    },
        { transaction },
    );

        return alerts;
    }

    static async bulkImport(data, options) {
        const currentUser = (options && options.currentUser) || { id: null };
        const transaction = (options && options.transaction) || undefined;

        // Prepare data - wrapping individual data transformations in a map() method
        const alertsData = data.map((item, index) => ({
                id: item.id || undefined,

                message: item.message
            ||
            null
            ,

                triggered_at: item.triggered_at
            ||
            null
            ,

            importHash: item.importHash || null,
            createdById: currentUser.id,
            updatedById: currentUser.id,
            createdAt: new Date(Date.now() + index * 1000),
    }));

        // Bulk create items
        const alerts = await db.alerts.bulkCreate(alertsData, { transaction });

        return alerts;
    }

    static async update(id, data, options) {
        const currentUser = (options && options.currentUser) || {id: null};
        const transaction = (options && options.transaction) || undefined;

        const alerts = await db.alerts.findByPk(id, {}, {transaction});

        const updatePayload = {};

        if (data.message !== undefined) updatePayload.message = data.message;

        if (data.triggered_at !== undefined) updatePayload.triggered_at = data.triggered_at;

        updatePayload.updatedById = currentUser.id;

        await alerts.update(updatePayload, {transaction});

        return alerts;
    }

    static async deleteByIds(ids, options) {
        const currentUser = (options && options.currentUser) || { id: null };
        const transaction = (options && options.transaction) || undefined;

        const alerts = await db.alerts.findAll({
            where: {
                id: {
                    [Op.in]: ids,
                },
            },
            transaction,
        });

        await db.sequelize.transaction(async (transaction) => {
            for (const record of alerts) {
                await record.update(
                    {deletedBy: currentUser.id},
                    {transaction}
                );
            }
            for (const record of alerts) {
                await record.destroy({transaction});
            }
        });

        return alerts;
    }

    static async remove(id, options) {
        const currentUser = (options && options.currentUser) || {id: null};
        const transaction = (options && options.transaction) || undefined;

        const alerts = await db.alerts.findByPk(id, options);

        await alerts.update({
            deletedBy: currentUser.id
        }, {
            transaction,
        });

        await alerts.destroy({
            transaction
        });

        return alerts;
    }

    static async findBy(where, options) {
        const transaction = (options && options.transaction) || undefined;

        const alerts = await db.alerts.findOne(
            { where },
            { transaction },
        );

        if (!alerts) {
            return alerts;
        }

        const output = alerts.get({plain: true});

        return output;
    }

    static async findAll(filter, options) {
        const limit = filter.limit || 0;
        let offset = 0;
        let where = {};
        const currentPage = +filter.page;

        const user = (options && options.currentUser) || null;

        offset = currentPage * limit;

        const orderBy = null;

        const transaction = (options && options.transaction) || undefined;

        let include = [];

        if (filter) {
            if (filter.id) {
                where = {
                    ...where,
                    ['id']: Utils.uuid(filter.id),
                };
            }

                if (filter.message) {
                    where = {
                        ...where,
                        [Op.and]: Utils.ilike(
                            'alerts',
                            'message',
                            filter.message,
                        ),
                    };
                }

            if (filter.triggered_atRange) {
                const [start, end] = filter.triggered_atRange;

                if (start !== undefined && start !== null && start !== '') {
                    where = {
                        ...where,
                    triggered_at: {
                    ...where.triggered_at,
                            [Op.gte]: start,
                    },
                };
                }

                if (end !== undefined && end !== null && end !== '') {
                    where = {
                        ...where,
                    triggered_at: {
                    ...where.triggered_at,
                            [Op.lte]: end,
                    },
                };
                }
            }

            if (filter.active !== undefined) {
                where = {
                    ...where,
                    active: filter.active === true || filter.active === 'true'
                };
            }

            if (filter.createdAtRange) {
                const [start, end] = filter.createdAtRange;

                if (start !== undefined && start !== null && start !== '') {
                    where = {
                        ...where,
                        ['createdAt']: {
                            ...where.createdAt,
                            [Op.gte]: start,
                        },
                    };
                }

                if (end !== undefined && end !== null && end !== '') {
                    where = {
                        ...where,
                        ['createdAt']: {
                            ...where.createdAt,
                            [Op.lte]: end,
                        },
                    };
                }
            }
        }

        const queryOptions = {
            where,
            include,
            distinct: true,
            order: filter.field && filter.sort
                ? [[filter.field, filter.sort]]
                : [['createdAt', 'desc']],
            transaction: options?.transaction,
            logging: console.log
        };

        if (!options?.countOnly) {
            queryOptions.limit = limit ? Number(limit) : undefined;
            queryOptions.offset = offset ? Number(offset) : undefined;
        }

        try {
            const { rows, count } = await db.alerts.findAndCountAll(queryOptions);

            return {
                rows: options?.countOnly ? [] : rows,
                count: count
            };
        } catch (error) {
            console.error('Error executing query:', error);
            throw error;
        }
    }

    static async findAllAutocomplete(query, limit, offset) {
        let where = {};

        if (query) {
            where = {
                [Op.or]: [
                    { ['id']: Utils.uuid(query) },
                    Utils.ilike(
                        'alerts',
                        'message',
                        query,
                    ),
                ],
            };
        }

        const records = await db.alerts.findAll({
            attributes: [ 'id', 'message' ],
            where,
            limit: limit ? Number(limit) : undefined,
            offset: offset ? Number(offset) : undefined,
            orderBy: [['message', 'ASC']],
        });

        return records.map((record) => ({
            id: record.id,
            label: record.message,
        }));
    }

};

