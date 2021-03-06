/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

/**
 * Implemetation of the various actions that can be performed on subscriptions.
 * @class
 */
var SubscriptionActions =
{
  /**
   * Returns the subscription list currently having focus if any.
   * @type Element
   */
  get focusedList()
  {
    return E("tabs").selectedPanel.getElementsByTagName("richlistbox")[0];
  },

  /**
   * Returns the currently selected and focused subscription item if any.
   * @type Element
   */
  get selectedItem()
  {
    let list = this.focusedList;
    return (list ? list.selectedItem : null);
  },

  /**
   * Finds the subscription for a particular rule, selects it and selects the
   * rule.
   */
  selectRule: function(/**Rule*/ rule)
  {
    let node = null;
    let tabIndex = -1;
    let subscriptions = rule.subscriptions.slice();
    subscriptions.sort(function(s1, s2) s1.disabled - s2.disabled);
    for (let i = 0; i < subscriptions.length; i++)
    {
      let subscription = subscriptions[i];
      let list = E(subscription instanceof SpecialSubscription ? "groups" : "subscriptions");
      tabIndex = (subscription instanceof SpecialSubscription ? 1 : 0);
      node = Templater.getNodeForData(list, "subscription", subscription);
      if (node)
        break;
    }
    if (node)
    {
      E("tabs").selectedIndex = tabIndex;
      Utils.runAsync(function()
      {
        node.parentNode.ensureElementIsVisible(node);
        node.parentNode.selectItem(node);
        if (!RuleActions.visible)
          E("subscription-showHideRules-command").doCommand();
        Utils.runAsync(RuleView.selectRule, RuleView, rule);
      });
    }
  },

  /**
   * Updates subscription commands whenever the selected subscription changes.
   * Note: this method might be called with a wrong "this" value.
   */
  updateCommands: function()
  {
    let node = SubscriptionActions.selectedItem;
    let data = Templater.getDataForNode(node);
    let subscription = (data ? data.subscription : null)
    E("subscription-update-command").setAttribute("disabled", !subscription ||
        !(subscription instanceof DownloadableSubscription) ||
        Synchronizer.isExecuting(subscription.url));
    E("subscription-moveUp-command").setAttribute("disabled", !subscription ||
        !node || !node.previousSibling || !!node.previousSibling.id);
    E("subscription-moveDown-command").setAttribute("disabled", !subscription ||
        !node || !node.nextSibling || !!node.nextSibling.id);
  },

  /**
   * Starts title editing for the selected subscription.
   */
  editTitle: function()
  {
    let node = this.selectedItem;
    if (node)
      TitleEditor.start(node);
  },

  /**
   * Triggers re-download of a rule subscription.
   */
  updateRules: function(/**Node*/ node)
  {
    let data = Templater.getDataForNode(node || this.selectedItem);
    if (data && data.subscription instanceof DownloadableSubscription)
      Synchronizer.execute(data.subscription, true, true);
  },

  /**
   * Triggers re-download of all rule subscriptions.
   */
  updateAllRules: function()
  {
    for (let i = 0; i < RuleStorage.subscriptions.length; i++)
    {
      let subscription = RuleStorage.subscriptions[i];
      if (subscription instanceof DownloadableSubscription)
        Synchronizer.execute(subscription, true, true);
    }
  },

  /**
   * Sets Subscription.disabled field to a new value.
   */
  setDisabled: function(/**Element*/ node, /**Boolean*/ value)
  {
    let data = Templater.getDataForNode(node || this.selectedItem);
    if (data)
      data.subscription.disabled = value;
  },

  /**
   * Enables all disabled rules in a subscription.
   */
  enableRules: function(/**Element*/ node)
  {
    let data = Templater.getDataForNode(node);
    if (!data)
      return;

    let rules = data.subscription.rules;
    for (let i = 0, l = rules.length; i < l; i++)
      if (rules[i] instanceof ActiveRule && rules[i].disabled)
        rules[i].disabled = false;
  },

  /**
   * Removes a rule subscription from the list (after a warning).
   */
  remove: function(/**Node*/ node)
  {
    let data = Templater.getDataForNode(node || this.selectedItem);
    if (data && Utils.confirm(window, Utils.getString("remove_subscription_warning")))
      RuleStorage.removeSubscription(data.subscription);
  },

  /**
   * Adds a new rule group and allows the user to change its title.
   */
  addGroup: function()
  {
    let subscription = SpecialSubscription.create();
    RuleStorage.addSubscription(subscription);

    let list = E("groups");
    let node = Templater.getNodeForData(list, "subscription", subscription);
    if (node)
    {
      list.focus();
      list.ensureElementIsVisible(node);
      list.selectedItem = node;
      this.editTitle();
    }
  },

  /**
   * Moves a rule subscription one line up.
   */
  moveUp: function(/**Node*/ node)
  {
    node = Templater.getDataNode(node || this.selectedItem);
    let data = Templater.getDataForNode(node);
    if (!data)
      return;

    let previousData = Templater.getDataForNode(node.previousSibling);
    if (!previousData)
      return;

    RuleStorage.moveSubscription(data.subscription, previousData.subscription);
  },

  /**
   * Moves a rule subscription one line down.
   */
  moveDown: function(/**Node*/ node)
  {
    node = Templater.getDataNode(node || this.selectedItem);
    let data = Templater.getDataForNode(node);
    if (!data)
      return;

    let nextNode = node.nextSibling;
    if (!Templater.getDataForNode(nextNode))
      return;

    let nextData = Templater.getDataForNode(nextNode.nextSibling);
    RuleStorage.moveSubscription(data.subscription, nextData ? nextData.subscription : null);
  },

  /**
   * Opens the context menu for a subscription node.
   */
  openMenu: function(/**Event*/ event, /**Node*/ node)
  {
    node.getElementsByClassName("actionMenu")[0].openPopupAtScreen(event.screenX, event.screenY, true);
  },

  _altMask: 2,
  _ctrlMask: 4,
  _metaMask: 8,
  get _accelMask()
  {
    let result = this._ctrlMask;
    try {
      let accelKey = Services.prefs.getIntPref("ui.key.accelKey");
      if (accelKey == Ci.nsIDOMKeyEvent.DOM_VK_META)
        result = this._metaMask;
      else if (accelKey == Ci.nsIDOMKeyEvent.DOM_VK_ALT)
        result = this._altMask;
    } catch(e) {}
    Object.defineProperty(this, "_accelMask", {
      get: function() result
    });
    return result;
  },

  /**
   * Called when a key is pressed on the subscription list.
   */
  keyPress: function(/**Event*/ event)
  {
    let modifiers = 0;
    if (event.altKey)
      modifiers |= this._altMask;
    if (event.ctrlKey)
      modifiers |= this._ctrlMask;
    if (event.metaKey)
      modifiers |= this._metaMask;

    if (event.charCode == " ".charCodeAt(0) && modifiers == 0)
    {
      // Ignore if Space is pressed on a button
      for (let node = event.target; node; node = node.parentNode)
        if (node.localName == "button")
          return;

      let data = Templater.getDataForNode(this.selectedItem);
      if (data)
        data.subscription.disabled = !data.subscription.disabled;
    }
    else if (event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_UP && modifiers == this._accelMask)
    {
      E("subscription-moveUp-command").doCommand();
      event.preventDefault();
      event.stopPropagation();
    }
    else if (event.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_DOWN && modifiers == this._accelMask)
    {
      E("subscription-moveDown-command").doCommand();
      event.preventDefault();
      event.stopPropagation();
    }
  },

  /**
   * Subscription currently being dragged if any.
   * @type Subscription
   */
  dragSubscription: null,

  /**
   * Called when a subscription entry is dragged.
   */
  startDrag: function(/**Event*/ event, /**Node*/ node)
  {
    let data = Templater.getDataForNode(node);
    if (!data)
      return;

    event.dataTransfer.addElement(node);
    event.dataTransfer.setData("text/x-moz-url", data.subscription.url);
    event.dataTransfer.setData("text/plain", data.subscription.title);
    this.dragSubscription = data.subscription;
    event.stopPropagation();
  },

  /**
   * Called when something is dragged over a subscription entry or subscriptions list.
   */
  dragOver: function(/**Event*/ event)
  {
    // Don't allow dragging onto a scroll bar
    for (let node = event.originalTarget; node; node = node.parentNode)
      if (node.localName == "scrollbar")
        return;

    // Don't allow dragging onto element's borders
    let target = event.originalTarget;
    while (target && target.localName != "richlistitem")
      target = target.parentNode;
    if (!target)
      target = event.originalTarget;

    let styles = window.getComputedStyle(target, null);
    let rect = target.getBoundingClientRect();
    if (event.clientX < rect.left + parseInt(styles.borderLeftWidth, 10) ||
        event.clientY < rect.top + parseInt(styles.borderTopWidth, 10) ||
        event.clientX > rect.right - parseInt(styles.borderRightWidth, 10) - 1 ||
        event.clientY > rect.bottom - parseInt(styles.borderBottomWidth, 10) - 1)
    {
      return;
    }

    // If not dragging a subscription check whether we can accept plain text
    if (!this.dragSubscription)
    {
      let data = Templater.getDataForNode(event.target);
      if (!data || !(data.subscription instanceof SpecialSubscription) || !event.dataTransfer.getData("text/plain"))
        return;
    }

    event.preventDefault();
    event.stopPropagation();
  },

  /**
   * Called when something is dropped on a subscription entry or subscriptions list.
   */
  drop: function(/**Event*/ event, /**Node*/ node)
  {
    if (!this.dragSubscription)
    {
      // Not dragging a subscription, maybe this is plain text that we can add as rules?
      let data = Templater.getDataForNode(node);
      if (data && data.subscription instanceof SpecialSubscription)
      {
        let lines = event.dataTransfer.getData("text/plain").replace(/\r/g, "").split("\n");
        for (let i = 0; i < lines.length; i++)
        {
          let rule = Rule.fromText(lines[i]);
          if (rule)
            RuleStorage.addRule(rule, data.subscription);
        }
        RuleActions.removeDraggedRules();
        event.stopPropagation();
      }
      return;
    }

    // When dragging down we need to insert after the drop node, otherwise before it.
    node = Templater.getDataNode(node);
    if (node)
    {
      let dragNode = Templater.getNodeForData(node.parentNode, "subscription", this.dragSubscription);
      if (node.compareDocumentPosition(dragNode) & node.DOCUMENT_POSITION_PRECEDING)
        node = node.nextSibling;
    }

    let data = Templater.getDataForNode(node);
    RuleStorage.moveSubscription(this.dragSubscription, data ? data.subscription : null);
    event.stopPropagation();
  },

  /**
   * Called when the drag operation for a subscription is finished.
   */
  endDrag: function()
  {
    this.dragSubscription = null;
  }
};

/**
 * Subscription title editing functionality.
 * @class
 */
var TitleEditor =
{
  /**
   * List item corresponding with the currently edited subscription if any.
   * @type Node
   */
  subscriptionEdited: null,

  /**
   * Starts editing of a subscription title.
   * @param {Node} node subscription list entry or a child node
   * @param {Boolean} [checkSelection] if true the editor will not start if the
   *        item was selected in the preceding mousedown event
   */
  start: function(node, checkSelection)
  {
    if (this.subscriptionEdited)
      this.end(true);

    let subscriptionNode = Templater.getDataNode(node);
    if (!subscriptionNode || (checkSelection && !subscriptionNode._wasSelected))
      return;

    subscriptionNode.getElementsByClassName("titleBox")[0].selectedIndex = 1;
    let editor = subscriptionNode.getElementsByClassName("titleEditor")[0];
    editor.value = Templater.getDataForNode(subscriptionNode).subscription.title;
    editor.setSelectionRange(0, editor.value.length);
    this.subscriptionEdited = subscriptionNode;
    editor.focus();
  },

  /**
   * Stops editing of a subscription title.
   * @param {Boolean} save if true the entered value will be saved, otherwise dismissed
   */
  end: function(save)
  {
    if (!this.subscriptionEdited)
      return;

    let subscriptionNode = this.subscriptionEdited;
    this.subscriptionEdited = null;

    let newTitle = null;
    if (save)
    {
      newTitle = subscriptionNode.getElementsByClassName("titleEditor")[0].value;
      newTitle = newTitle.replace(/^\s+/, "").replace(/\s+$/, "");
    }

    let subscription = Templater.getDataForNode(subscriptionNode).subscription
    if (newTitle && newTitle != subscription.title)
      subscription.title = newTitle;
    else
    {
      subscriptionNode.getElementsByClassName("titleBox")[0].selectedIndex = 0;
      subscriptionNode.parentNode.focus();
    }
  },

  /**
   * Processes keypress events on the subscription title editor field.
   */
  keyPress: function(/**Event*/ event)
  {
    // Prevent any key presses from triggering outside actions
    event.stopPropagation();

    if (event.keyCode == event.DOM_VK_RETURN || event.keyCode == event.DOM_VK_ENTER)
    {
      event.preventDefault();
      this.end(true);
    }
    else if (event.keyCode == event.DOM_VK_CANCEL || event.keyCode == event.DOM_VK_ESCAPE)
    {
      event.preventDefault();
      this.end(false);
    }
  }
};

/**
 * Methods called when choosing and adding a new rule subscription.
 * @class
 */
var SelectSubscription =
{
  /**
   * Starts selection of a rule subscription to add.
   */
  start: function(/**Event*/ event)
  {
    let panel = E("selectSubscriptionPanel");
    let list = E("selectSubscription");
    let template = E("selectSubscriptionTemplate");
    let parent = list.menupopup;

    if (panel.state == "open")
    {
      list.focus();
      return;
    }

    // Remove existing entries if any
    while (parent.lastChild)
      parent.removeChild(parent.lastChild);

    // Load data
    let request = new XMLHttpRequest();
    request.open("GET", "subscriptions.xml");
    request.onload = function()
    {
      // Avoid race condition if two downloads are started in parallel
      if (panel.state == "open")
        return;

      // Add subscription entries to the list
      let subscriptions = request.responseXML.getElementsByTagName("subscription");
      let listedSubscriptions = [];
      for (let i = 0; i < subscriptions.length; i++)
      {
        let subscription = subscriptions[i];
        let url = subscription.getAttribute("url");
        if (!url || url in RuleStorage.knownSubscriptions)
          continue;

        let localePrefix = Utils.checkLocalePrefixMatch(subscription.getAttribute("prefixes"));
        let node = Templater.process(template, Utils.createObjectWithPrototype(null, {
          node: subscription,
          localePrefix: localePrefix
        }));
        parent.appendChild(node);
        listedSubscriptions.push(subscription);
      }
      let selectedNode = Utils.chooseRuleSubscription(listedSubscriptions);
      list.selectedItem = Templater.getNodeForData(parent, "node", selectedNode) || parent.firstChild;

      // Show panel and focus list
      let position = (Services.vc.compare(Utils.platformVersion, "2.0") < 0 ? "after_end" : "bottomcenter topleft");
      panel.openPopup(E("selectSubscriptionButton"), position, 0, 0, false, false, event);
      Utils.runAsync(list.focus, list);
    };
    try {
      request.send();
    } catch (e) {
      Cu.reportError(e);
    }
  },

  /**
   * Adds rule subscription that is selected.
   */
  add: function()
  {
    E("selectSubscriptionPanel").hidePopup();

    let data = Templater.getDataForNode(E("selectSubscription").selectedItem);
    if (!data)
      return;

    let subscription = Subscription.fromURL(data.node.getAttribute("url"));
    if (!subscription)
      return;

    RuleStorage.addSubscription(subscription);
    subscription.disabled = false;
    subscription.title = data.node.getAttribute("title");
    subscription.homepage = data.node.getAttribute("homepage");

    // Make sure the subscription is visible and selected
    let list = E("subscriptions");
    let node = Templater.getNodeForData(list, "subscription", subscription);
    if (node)
    {
      list.ensureElementIsVisible(node);
      list.selectedItem = node;
      list.focus();
    }

    // Trigger download if necessary
    if (subscription instanceof DownloadableSubscription && !subscription.lastDownload)
      Synchronizer.execute(subscription);
  },

  /**
   * Called if the user chooses to view the complete subscriptions list.
   */
  chooseOther: function()
  {
    E("selectSubscriptionPanel").hidePopup();
    window.openDialog("subscriptionSelection.xul", "_blank", "chrome,centerscreen,modal,resizable,dialog=no", null, null);
  },

  /**
   * Called for keys pressed on the subscription selection panel.
   */
  keyPress: function(/**Event*/ event)
  {
    // Buttons and text links handle Enter key themselves
    if (event.target.localName == "button" || event.target.localName == "label")
      return;

    if (event.keyCode == event.DOM_VK_RETURN || event.keyCode == event.DOM_VK_ENTER)
    {
      // This shouldn't accept our dialog, only the panel
      event.preventDefault();
      E("selectSubscriptionAccept").doCommand();
    }
  }
};
