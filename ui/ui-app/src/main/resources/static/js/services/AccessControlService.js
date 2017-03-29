/*-
 * #%L
 * thinkbig-ui-feed-manager
 * %%
 * Copyright (C) 2017 ThinkBig Analytics
 * %%
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * #L%
 */
/**
 * Service for interacting with the Access Control REST API.
 */

/**
 * A permission available to users and groups.
 *
 * @typedef {Object} Action
 * @property {Array.<Action>} [actions] child actions
 * @property {string} description a human-readable summary
 * @property {string} systemName unique identifier
 * @property {string} title a human-readable name
 */


/**
 * A collection of permissions available to users and groups.
 *
 * @typedef {Object} ActionSet
 * @property {Array.<Action> actions the set of permissions
 * @property {string} name the module name
 */

/**
 * A collection of permission changes for a set of users or groups.
 *
 * @typedef {Object} PermissionsChange
 * @property {ActionSet} actionSet the set of permissions that should be added or removed
 * @property {string} change indicates how to process the change; one of: ADD, REMOVE, or REPLACE
 * @property {Array.<string>} groups the groups that should have their permissions changed
 * @property {Array.<string>} users the users that should have their permissions changed
 */
define(['angular','services/module-name'], function (angular,moduleName) {
    return  angular.module(moduleName).factory("AccessControlService",["$http","$q","CommonRestUrlService","UserGroupService", function ($http, $q, CommonRestUrlService,UserGroupService) {

        var DEFAULT_MODULE = "services";

        /**
         * Interacts with the Access Control REST API.
         *
         * @constructor
         */
        function AccessControlService() {
        }

        angular.extend(AccessControlService.prototype, {

            /**
             * Allows access to categories.
             * @type {string}
             */
            CATEGORIES_ACCESS: "accessCategories",

            /**
             * Allows the administration of any category; even those created by others.
             * @type {string}
             */
            CATEGORIES_ADMIN: "adminCategories",

            /**
             * Allows creating and editing new categories.
             * @type {string}
             */
            CATEGORIES_EDIT: "editCategories",

            /**
             * Allows access to feeds.
             * @type {string}
             */
            FEEDS_ACCESS: "accessFeeds",

            /**
             * Allows the administration of any feed; even those created by others.
             * @type {string}
             */
            FEEDS_ADMIN: "adminFeeds",

            /**
             * Allows creating and editing new feeds.
             * @type {string}
             */
            FEEDS_EDIT: "editFeeds",

            /**
             * Allows exporting feeds definitions.
             * @type {string}
             */
            FEEDS_EXPORT: "exportFeeds",

            /**
             * Allows importing of previously exported feeds.
             * @type {string}
             */
            FEEDS_IMPORT: "importFeeds",

            /**
             * Allows access to feeds and feed-related functions.
             * @type {string}
             */
            FEED_MANAGER_ACCESS: "accessFeedsSupport",

            /**
             * Allows the ability to view existing groups.
             * @type {string}
             */
            GROUP_ACCESS: "accessGroups",

            /**
             * Allows the ability to create and manage groups.
             * @type {string}
             */
            GROUP_ADMIN: "adminGroups",

            /**
             * Allows access to feed templates.
             * @type {string}
             */
            TEMPLATES_ACCESS: "accessTemplates",

            /**
             * Allows the administration of any feed template; even those created by others.
             * @type {string}
             */
            TEMPLATES_ADMIN: "adminTemplates",

            /**
             * Allows created and editing new feed templates.
             * @type {string}
             */
            TEMPLATES_EDIT: "editTemplates",

            /**
             * Allows exporting template definitions.
             * @type {string}
             */
            TEMPLATES_EXPORT: "exportTemplates",

            /**
             * Allows importing of previously exported templates.
             * @type {string}
             */
            TEMPLATES_IMPORT: "importTemplates",

            /**
             * Allows the ability to view existing users.
             * @type {string}
             */
            USERS_ACCESS: "accessUsers",

            /**
             * Allows the ability to create and manage users.
             * @type {string}
             */
            USERS_ADMIN: "adminUsers",

            /**
             * Allows access to user and group-related functions.
             * @type {string}
             */
            USERS_GROUPS_ACCESS: "accessUsersGroupsSupport",

            /**
             * Allows administration of operations, such as stopping and abandoning them.
             * @type {string}
             */
            OPERATIONS_ADMIN: "adminOperations",

            /**
             * Allows access to operational information like active feeds and execution history, etc.
             * @type {string}
             */
            OPERATIONS_MANAGER_ACCESS: "accessOperations",

            /**
             * List of available actions
             *
             * @private
             * @type {Promise|null}
             */
            AVAILABLE_ACTIONS_: null,


            executingAllowedActions:{},


            getCurrentUser:function(){
                return UserGroupService.getCurrentUser();
            },

            /**
             * Gets the list of allowed actions for the specified users or groups. If no users or groups are specified, then gets the allowed actions for the current user.
             *
             * @param {string|null} [opt_module] name of the access module, or {@code null}
             * @param {string|Array.<string>|null} [opt_users] user name or list of user names or {@code null}
             * @param {string|Array.<string>|null} [opt_groups] group name or list of group names or {@code null}
             * @returns {Promise} containing an {@link ActionSet} with the allowed actions
             */
            getAllowedActions: function (opt_module, opt_users, opt_groups) {

                // Prepare query parameters
                var params = {};
                if (angular.isArray(opt_users) || angular.isString(opt_users)) {
                    params.user = opt_users;
                }
                if (angular.isArray(opt_groups) || angular.isString(opt_groups)) {
                    params.group = opt_groups;
                }

                // Send request
                var safeModule = angular.isString(opt_module) ? encodeURIComponent(opt_module) : DEFAULT_MODULE;
                return $http({
                    method: "GET",
                    params: params,
                    url: CommonRestUrlService.SECURITY_BASE_URL + "/actions/" + safeModule + "/allowed"
                }).then(function (response) {
                    if (angular.isUndefined(response.data.actions)) {
                        response.data.actions = [];
                    }
                    return response.data;
                });
            },


            /**
             * Gets the list of allowed actions for the current user.
             *
             * @param {string|null} [opt_module] name of the access module, or {@code null}
             * @returns {Promise} containing an {@link ActionSet} with the allowed actions
             */
            getUserAllowedActions: function (opt_module) {
                var self = this;
             var defer = null;
                var safeModule = angular.isString(opt_module) ? encodeURIComponent(opt_module) : DEFAULT_MODULE;
                var isExecuting = self.executingAllowedActions[safeModule] != undefined;
                if(!isExecuting) {
                     defer = $q.defer();
                    self.executingAllowedActions[safeModule] = defer;

                    var promise = $http.get(CommonRestUrlService.SECURITY_BASE_URL + "/actions/" + safeModule + "/allowed")
                        .then(function (response) {
                            if (angular.isUndefined(response.data.actions)) {
                                response.data.actions = [];
                            }
                            defer.resolve(response.data);
                            delete self.executingAllowedActions[safeModule];
                            return response.data;
                        });
                }
                else {

                    defer = self.executingAllowedActions[safeModule];
                }
                return defer.promise;
            },



            /**
             * Gets all available actions.
             *
             * @param {string|null} [opt_module] name of the access module, or {@code null}
             * @returns {Promise} containing an {@link ActionSet} with the allowed actions
             */
            getAvailableActions: function (opt_module) {
                // Send request
                if (this.AVAILABLE_ACTIONS_ === null) {
                    var safeModule = angular.isString(opt_module) ? encodeURIComponent(opt_module) : DEFAULT_MODULE;
                    this.AVAILABLE_ACTIONS_ = $http.get(CommonRestUrlService.SECURITY_BASE_URL + "/actions/" + safeModule + "/available")
                        .then(function (response) {
                            return response.data;
                        });
                }
                return this.AVAILABLE_ACTIONS_;
            },

            /**
             * Determines if any name in array of names is included in the allowed actions it will return true, otherwise false
             *
             * @param names an array of names
             * @param actions An array of allowed actions
             * @returns {boolean}
             */
            hasAnyAction: function (names, actions) {
                var self = this;
                var valid = _.find(names,function(name){
                    return self.hasAction(name.trim(),actions);
                });
                return valid != undefined;
            },

            /**
             * returns a promise with a value of true/false if the user has any of the required permissions
             * @param requiredPermissions
             */
            doesUserHavePermission: function(requiredPermissions){
                var self = this;
                var d = $q.defer();

                self.getUserAllowedActions()
                    .then(function (actionSet) {

                        var allowed = self.hasAnyAction(requiredPermissions, actionSet.actions);
                        d.resolve(allowed);
                    });
                return d.promise;
            },

            /**
             * Determines if the specified action is allowed.
             *
             * @param {string} name the name of the action
             * @param {Array.<Action>} actions the list of allowed actions
             * @returns {boolean} {@code true} if the action is allowed, or {@code false} if denied
             */
            hasAction: function (name, actions) {
                var self = this;
                return _.some(actions, function (action) {
                    if (action.systemName === name) {
                        return true;
                    } else if (angular.isArray(action.actions)) {
                        return self.hasAction(name, action.actions);
                    }
                    return false;
                });
            },

            /**
             * Sets the allowed actions for the specified users and groups.
             *
             * @param {string|null} module name of the access module, or {@code null}
             * @param {string|Array.<string>|null} users user name or list of user names or {@code null}
             * @param {string|Array.<string>|null} groups group name or list of group names or {@code null}
             * @param {Array.<Action>} actions list of actions to allow
             * @returns {Promise} containing an {@link ActionSet} with the saved actions
             */
            setAllowedActions: function (module, users, groups, actions) {
                // Build the request body
                var safeModule = angular.isString(module) ? module : DEFAULT_MODULE;
                var data = {actionSet: {name: safeModule, actions: actions}, change: "REPLACE"};

                if (angular.isArray(users)) {
                    data.users = users;
                } else if (angular.isString(users)) {
                    data.users = [users];
                }

                if (angular.isArray(groups)) {
                    data.groups = groups;
                } else if (angular.isString(groups)) {
                    data.groups = [groups];
                }

                // Send the request
                return $http({
                    data: angular.toJson(data),
                    method: "POST",
                    url: CommonRestUrlService.SECURITY_BASE_URL + "/actions/" + encodeURIComponent(safeModule) + "/allowed"
                }).then(function (response) {
                    if (angular.isUndefined(response.data.actions)) {
                        response.data.actions = [];
                    }
                    return response.data;
                });
            }
        });

        return new AccessControlService();
    }]);
});
